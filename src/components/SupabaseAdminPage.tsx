import React, { useEffect, useState } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { SlotTable } from './SlotTable';
import { readSnapshot, writeReservation, type Snapshot } from '../utils/reservation-api';
import { isSlotOpen } from '../utils/constants';
import { getSlaState, getSlaText } from '../utils/sla';
import { chooseAutoMatch } from '../utils/auto-match';
import { sendBookingEmail } from '../utils/booking-email';

interface Props { client: SupabaseClient; user: User }

export const SupabaseAdminPage: React.FC<Props> = ({ client, user }) => {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resetting, setResetting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [autoMatching, setAutoMatching] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setSnapshot(await readSnapshot(client, user.id, true));
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [client, user.id]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const slots = snapshot?.slots ?? {};
  const request = snapshot?.requests.find(item => item.id === selectedRequestId);
  const candidates = request
    ? snapshot?.candidates.filter(candidate => candidate.request_id === request.id && candidate.version === request.version).sort((a, b) => a.priority - b.priority) ?? []
    : [];

  const confirm = async () => {
    if (!request || !selectedSlotId) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await writeReservation(client, user.id, 'confirm_request', {
        p_request_id: request.id,
        p_slot_id: selectedSlotId,
        p_admin_id: user.id,
      });
      void sendBookingEmail(client, 'confirmed', request.id, selectedSlotId);
      setSuccess('Supabase 확정 저장 완료');
      setSelectedRequestId('');
      setSelectedSlotId('');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  };

  const resetData = async () => {
    if (!window.confirm('모든 신청·후보·확정·로그를 삭제하고 슬롯을 초기화할까요?')) return;
    setResetting(true);
    setError('');
    setSuccess('');
    try {
      const { data, error: resetError } = await client.rpc('admin_reset_reservations');
      if (resetError) throw resetError;
      if (!data?.success) throw new Error(data?.error || '초기화가 거절되었습니다.');
      setSuccess('예약 데이터 초기화 완료');
      setSelectedRequestId('');
      setSelectedSlotId('');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setResetting(false);
    }
  };

  const runAutoMatch = async () => {
    if (!snapshot) return;
    setAutoMatching(true);
    setError('');
    setSuccess('');
    let matched = 0;
    try {
      let current = snapshot;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const match = chooseAutoMatch(
          current.requests,
          current.candidates.map(candidate => ({
            requestId: candidate.request_id,
            slotId: candidate.slot_id,
            priority: candidate.priority,
            queueSeq: candidate.queue_seq,
            version: candidate.version,
          })),
          slotId => Boolean(current.slots[slotId]?.serverAvailable)
        );
        if (!match) break;
        await writeReservation(client, user.id, 'confirm_request', {
          p_request_id: match.requestId,
          p_slot_id: match.slotId,
          p_admin_id: user.id,
        });
        matched += 1;
        current = await readSnapshot(client, user.id, true);
      }
      setSuccess(matched ? `규칙 기반 자동 매칭 ${matched}건 완료` : '자동 매칭 가능한 신청이 없습니다.');
      setSnapshot(current);
      setSelectedRequestId('');
      setSelectedSlotId('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setAutoMatching(false);
    }
  };

  if (loading && !snapshot) return <p>Supabase 데이터를 불러오는 중...</p>;

  return (
    <div className="admin-page">
      <h2>Supabase 관리자 패널</h2>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      <button className="btn btn-warning" onClick={() => void resetData()} disabled={resetting}>
        {resetting ? '초기화 중...' : '예약 데이터 초기화'}
      </button>
      <button className="btn btn-primary" onClick={() => void runAutoMatch()} disabled={autoMatching || loading}>
        {autoMatching ? '자동 매칭 중...' : '규칙 기반 자동 매칭'}
      </button>
      <div className="supabase-admin-layout">
        <section className="supabase-panel">
          <h3>신청 목록 ({snapshot?.requests.length ?? 0}건)</h3>
          <div className="request-list">
            {(snapshot?.requests ?? []).map((item, index) => (
              <button
                className={`request-list-item${selectedRequestId === item.id ? ' selected' : ''}`}
                key={item.id}
                onClick={() => { setSelectedRequestId(item.id); setSelectedSlotId(''); }}
              >
                <strong>#{index + 1} {item.customer_email || item.customer_id}</strong>
                <span>버전 {item.version} · {item.status}</span>
                <span className={getSlaState(item.created_at, item.status, now) === 'expired' ? 'sla-expired' : ''}>
                  {getSlaText(item.created_at, item.status, now)}
                </span>
                <small>{new Date(item.created_at).toLocaleString('ko-KR')}</small>
              </button>
            ))}
            {!snapshot?.requests.length && <p>접수된 신청이 없습니다.</p>}
          </div>
        </section>
        <section className="supabase-panel">
          <h3>신청 상세</h3>
          {request ? (
            <>
              <div className="form-group">
                <label>고객 계정</label>
                <input type="text" value={request.customer_email || request.customer_id} readOnly />
              </div>
              <p>상태: <strong>{request.status}</strong> · 버전 {request.version} · {getSlaText(request.created_at, request.status, now)}</p>
              <h4>희망 슬롯 (우선순위 순)</h4>
              <ul className="list">
                {candidates.map(candidate => (
                  <li key={candidate.id}>
                    <button
                      className={`slot-choice${selectedSlotId === candidate.slot_id ? ' selected' : ''}`}
                      onClick={() => setSelectedSlotId(candidate.slot_id)}
                      disabled={!isSlotOpen(slots[candidate.slot_id]) || request.status === 'confirmed'}
                    >
                      {candidate.priority}. {candidate.slot_id} {isSlotOpen(slots[candidate.slot_id]) ? '(가능)' : '(마감)'}
                    </button>
                  </li>
                ))}
              </ul>
              <button className="btn btn-primary" onClick={() => void confirm()} disabled={!selectedSlotId || saving || request.status === 'confirmed'}>
                {saving ? '저장 중...' : '확정 저장'}
              </button>
            </>
          ) : <p>왼쪽 신청 목록에서 신청을 선택하세요.</p>}
        </section>
      </div>
      <h3>슬롯 현황</h3>
      <SlotTable slots={slots} selectedSlots={[]} onToggle={() => {}} mode="view" />
      <button className="btn btn-secondary" onClick={() => void load()} disabled={loading}>새로고침</button>
    </div>
  );
};
