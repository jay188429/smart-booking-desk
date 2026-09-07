import React, { useEffect, useState } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { SlotTable } from './SlotTable';
import { readSnapshot, writeReservation, type Snapshot } from '../utils/reservation-api';
import { TIME_SLOTS, isSlotOpen } from '../utils/constants';
import { getSlaState, getSlaText } from '../utils/sla';
import { recommendAlternativeSlots } from '../utils/recommend';

interface Props { client: SupabaseClient; user: User }

export const SupabaseCustomerPage: React.FC<Props> = ({ client, user }) => {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const load = async () => {
    setLoading(true);
    try {
      setSnapshot(await readSnapshot(client, user.id, false));
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

  const currentRequest = snapshot?.requests[snapshot.requests.length - 1];
  const currentCandidates = currentRequest
    ? snapshot?.candidates.filter(c => c.request_id === currentRequest.id && c.version === currentRequest.version).sort((a, b) => a.priority - b.priority) ?? []
    : [];
  const slots = snapshot?.slots ?? {};
  const canSubmit = selectedSlots.length >= 1 && selectedSlots.length <= 3;
  const needsReselection = currentRequest?.status === 'needs_reselection';
  const hasReservation = Boolean(currentRequest);

  const toggle = (slotId: string) => {
    setSelectedSlots(previous => previous.includes(slotId)
      ? previous.filter(id => id !== slotId)
      : previous.length < 3 ? [...previous, slotId] : previous);
    setError('');
  };

  const submit = async (slotIds = selectedSlots) => {
    if (slotIds.length < 1 || slotIds.length > 3) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const action = needsReselection ? 'resubmit_request' : 'submit_request';
      const payload = needsReselection
        ? { p_customer_id: user.id, p_request_id: currentRequest!.id, p_slot_ids: selectedSlots }
        : { p_customer_id: user.id, p_slot_ids: slotIds };
      if (needsReselection) payload.p_slot_ids = slotIds;
      await writeReservation(client, user.id, action, payload);
      setSelectedSlots([]);
      setSuccess(needsReselection ? 'Supabase 재선택 저장 완료' : 'Supabase 접수 저장 완료');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  };

  const recommendedSlots = needsReselection
    ? recommendAlternativeSlots(slots, currentCandidates.map(candidate => candidate.slot_id))
    : [];

  if (loading && !snapshot) return <p>Supabase 데이터를 불러오는 중...</p>;

  return (
    <div className="customer-page">
      <p>로그인 계정: {user.email ?? user.id}</p>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      {currentRequest && (
        <div className={`alert ${getSlaState(currentRequest.created_at, currentRequest.status, now) === 'expired' ? 'alert-error' : currentRequest.status === 'confirmed' ? 'alert-success' : 'alert-info'}`}>
          현재 신청 상태: {currentRequest.status === 'confirmed' ? '확정됨' : needsReselection ? '재선택 필요' : '접수됨'}
          {' · '}{getSlaText(currentRequest.created_at, currentRequest.status, now)}
          {currentRequest.confirmed_slot_id && ` · ${currentRequest.confirmed_slot_id}`}
        </div>
      )}
      {currentCandidates.length > 0 && (
        <div>
          <h3>현재 희망 슬롯</h3>
          <ol>
            {currentCandidates.map(candidate => <li key={candidate.id}>{candidate.slot_id}</li>)}
          </ol>
        </div>
      )}
      {!hasReservation || needsReselection ? (
        <>
          <h3>{needsReselection ? '슬롯 재선택' : '슬롯 신청 (1~3개)'}</h3>
          {recommendedSlots.length > 0 && (
            <div className="recommendation-panel">
              <h4>추천 대안 슬롯</h4>
              <p>가능한 가장 이른 시간부터 추천합니다. 버튼을 누르면 바로 재선택됩니다.</p>
              <div className="recommendation-list">
                {recommendedSlots.map(slotId => (
                  <button key={slotId} className="btn btn-secondary" onClick={() => void submit([slotId])} disabled={saving}>
                    {slotId}
                  </button>
                ))}
              </div>
            </div>
          )}
          <SlotTable slots={slots} selectedSlots={selectedSlots} onToggle={toggle} mode="select" maxSelect={3} />
          <button className="btn btn-primary" onClick={() => void submit()} disabled={!canSubmit || saving}>
            {saving ? '저장 중...' : 'Supabase에 저장'}
          </button>
        </>
      ) : null}
      {currentRequest?.confirmed_slot_id && (
        <p className="alert alert-success">확정 슬롯: {currentRequest.confirmed_slot_id}</p>
      )}
      <button className="btn btn-secondary" onClick={() => void load()} disabled={loading}>새로고침</button>
      <small>
        {TIME_SLOTS.length}개 시간대, 서버 가용성 기준. {Object.values(slots).filter(slot => isSlotOpen(slot)).length}개 선택 가능
      </small>
    </div>
  );
};
