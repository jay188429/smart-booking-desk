import React, { useEffect, useState } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { SlotTable } from './SlotTable';
import { readSnapshot, writeReservation, type Snapshot } from '../utils/reservation-api';
import { TIME_SLOTS, parseSlotId } from '../utils/constants';
import { getSlaState, getSlaText } from '../utils/sla';
import { recommendAlternativeSlots } from '../utils/recommend';
import { sendBookingEmail } from '../utils/booking-email';

interface Props { client: SupabaseClient; user: User }

export const SupabaseCustomerPage: React.FC<Props> = ({ client, user }) => {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setSnapshot(await readSnapshot(client, user.id, false));
      setLastCheckedAt(Date.now());
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
  const currentSlaState = currentRequest
    ? getSlaState(currentRequest.created_at, currentRequest.status, now)
    : null;

  const formatSlot = (slotId: string) => {
    const parsed = parseSlotId(slotId);
    const time = parsed ? TIME_SLOTS.find(item => item.label === parsed.timeLabel) : undefined;
    return parsed && time ? `${parsed.date.replace(/-/g, '.')} · ${time.displayLabel}` : slotId;
  };

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
    try {
      const action = needsReselection ? 'resubmit_request' : 'submit_request';
      const payload = needsReselection
        ? { p_customer_id: user.id, p_request_id: currentRequest!.id, p_slot_ids: selectedSlots }
        : { p_customer_id: user.id, p_slot_ids: slotIds };
      if (needsReselection) payload.p_slot_ids = slotIds;
      const result = await writeReservation(client, user.id, action, payload);
      if (result.requestId) void sendBookingEmail(client, 'submitted', result.requestId);
      setSelectedSlots([]);
      setReviewing(false);
      await load();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      setError(/404|not found|schema cache|cancel_request/i.test(message)
        ? '다시 신청 기능이 아직 Supabase에 설치되지 않았습니다. SQL Editor에서 sql/03_cancel_request.sql을 실행한 뒤 다시 시도하세요.'
        : message);
    } finally {
      setSaving(false);
    }
  };

  const recommendedSlots = needsReselection
    ? recommendAlternativeSlots(slots, currentCandidates.map(candidate => candidate.slot_id))
    : [];
  const displayName = String(user.user_metadata?.full_name || user.user_metadata?.name || user.email || user.id);

  const formatCommunicationTime = (value: string | null | undefined) => value
    ? new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '방금 전';

  const beginReview = () => {
    if (!canSubmit) return;
    setError('');
    setReviewing(true);
  };

  const cancelPendingRequest = async () => {
    if (!currentRequest || currentRequest.status === 'confirmed') return;
    if (!window.confirm('아직 확정되지 않은 신청을 취소하고 새로 선택할까요?')) return;
    setSaving(true);
    setError('');
    try {
      await writeReservation(client, user.id, 'cancel_request', {
        p_customer_id: user.id,
        p_request_id: currentRequest.id,
      });
      setReviewing(false);
      setSelectedSlots([]);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !snapshot) return <p>Supabase 데이터를 불러오는 중...</p>;

  return (
    <div className="customer-page">
      <div className="booking-shell">
        <aside className="booking-sidebar">
          <div className="booking-avatar" aria-hidden="true">d</div>
          <span className="eyebrow">cal.dudu</span>
          <h2>예약 가능한 시간을 선택해 주세요</h2>
          <p>희망 시간 1~3개를 선택하면 운영자가 확인 후 예약을 확정합니다.</p>
          <div className="booking-detail"><span aria-hidden="true">◷</span><span>30분 상담</span></div>
          <div className="booking-detail"><span aria-hidden="true">◎</span><span>한국 시간 (KST)</span></div>
          <p className="booking-account">로그인 계정<br /><strong>{user.email ?? user.id}</strong></p>
        </aside>

        <main className="booking-main">
          {error && <div className="alert alert-error">{error}</div>}
          {currentRequest && (
        <section className={`booking-status-card booking-status-${currentRequest.status}`} aria-live="polite">
          <div className="booking-status-heading">
            <div>
              <span className="eyebrow">예약 신청 결과</span>
              <h2>{currentRequest.status === 'confirmed' ? '예약이 확정되었습니다' : needsReselection ? '다시 시간을 선택해 주세요' : '예약 확정을 기다리고 있습니다'}</h2>
            </div>
            <span className="status-pill">
              {currentRequest.status === 'confirmed' ? '확정 완료' : needsReselection ? '재선택 필요' : '확정 대기'}
            </span>
          </div>

          <div className="booking-progress" aria-label="예약 진행 상태">
            <span className="progress-step complete"><b>1</b>신청 완료</span>
            <span className="progress-line complete" />
            <span className={`progress-step ${currentRequest.status === 'received' ? 'current' : 'complete'}`}><b>2</b>운영자 확인</span>
            <span className="progress-line" />
            <span className={`progress-step ${currentRequest.status === 'confirmed' ? 'current' : ''}`}><b>3</b>예약 확정</span>
          </div>

          <p className="booking-status-message">
            {currentRequest.status === 'confirmed'
              ? '아래 시간으로 예약이 확정되었습니다. 안내 내용을 확인해 주세요.'
              : needsReselection
                ? '선택하신 시간대가 모두 마감되었습니다. 새로운 희망 시간을 선택하면 다시 접수할 수 있습니다.'
                : '희망 시간을 운영자가 확인하고 있습니다. 확정되면 이 화면의 상태가 자동으로 업데이트됩니다.'}
          </p>

          <div className="booking-status-meta">
            <span>현재 상태</span>
            <strong>{currentSlaState === 'expired' ? '확정 기한 초과 · 운영자 확인 필요' : getSlaText(currentRequest.created_at, currentRequest.status, now)}</strong>
          </div>
          {currentRequest.confirmed_slot_id && (
            <div className="confirmed-slot">
              <span>확정된 예약 시간</span>
              <strong>{formatSlot(currentRequest.confirmed_slot_id)}</strong>
            </div>
          )}
          {currentRequest.status === 'received' && (
            <p className="booking-status-next">이 페이지는 5초마다 예약 상태를 확인합니다. 페이지를 닫아도 신청은 유지됩니다.</p>
          )}
          {currentRequest.status !== 'confirmed' && (
            <button className="booking-cancel-button" type="button" onClick={() => void cancelPendingRequest()} disabled={saving}>
              신청 취소 후 다시 선택
            </button>
          )}
          </section>
          )}
          {currentRequest && (
            <section className="communication-panel" aria-label="예약 상태 업데이트">
              <div className="communication-heading">
                <div>
                  <span className="eyebrow">예약 알림</span>
                  <h3>예약 상태 업데이트</h3>
                </div>
                <span className="communication-live"><i /> 자동 확인 중</span>
              </div>
              <div className="communication-timeline">
                <div className="communication-item complete">
                  <span className="communication-icon">✓</span>
                  <div><strong>신청이 접수되었습니다</strong><p>희망하신 시간이 운영자에게 전달되었습니다.</p><time>{formatCommunicationTime(currentRequest.created_at)}</time></div>
                </div>
                {currentRequest.status === 'received' ? (
                  <div className="communication-item active">
                    <span className="communication-icon">·</span>
                    <div><strong>운영자가 시간을 확인하고 있습니다</strong><p>확정되면 이 화면에 바로 안내됩니다.</p><time>다음 자동 확인까지 5초</time></div>
                  </div>
                ) : currentRequest.status === 'confirmed' ? (
                  <div className="communication-item complete">
                    <span className="communication-icon">✓</span>
                    <div><strong>예약 확정 안내</strong><p>확정된 시간으로 상담 예약이 완료되었습니다.</p><time>{formatCommunicationTime(currentRequest.confirmed_at || currentRequest.updated_at)}</time></div>
                  </div>
                ) : (
                  <div className="communication-item attention">
                    <span className="communication-icon">!</span>
                    <div><strong>새로운 시간 선택이 필요합니다</strong><p>기존 희망 시간이 모두 마감되어 다시 선택해 주세요.</p><time>{formatCommunicationTime(currentRequest.updated_at)}</time></div>
                  </div>
                )}
              </div>
              {lastCheckedAt && <p className="communication-refresh">마지막 확인 {formatCommunicationTime(new Date(lastCheckedAt).toISOString())} · 페이지를 닫아도 신청은 유지됩니다.</p>}
            </section>
          )}
          {currentCandidates.length > 0 && (
        <div className="candidate-summary">
          <h3>내가 선택한 희망 시간</h3>
          <ol>
            {currentCandidates.map(candidate => <li key={candidate.id}><span>희망 {candidate.priority}</span><strong>{formatSlot(candidate.slot_id)}</strong></li>)}
          </ol>
        </div>
          )}
          {!hasReservation || needsReselection ? (
        <>
          {!reviewing ? (
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
              <button className="btn btn-primary booking-next-button" onClick={beginReview} disabled={!canSubmit || saving}>
                다음: 예약 확인
              </button>
            </>
          ) : (
            <section className="booking-confirm-panel">
              <div className="booking-confirm-heading">
                <button className="booking-back-button" type="button" onClick={() => setReviewing(false)} disabled={saving}>‹ 뒤로</button>
                <h3>예약 신청 확인</h3>
              </div>
              <div className="booking-form">
                <label htmlFor="booking-name">이름 <span>(로그인 계정)</span></label>
                <input id="booking-name" value={displayName} readOnly />
                <label htmlFor="booking-email">이메일 주소 <span>(필수)</span></label>
                <input id="booking-email" value={user.email ?? ''} readOnly />
              </div>
              <div className="booking-selection-card">
                <span>선택한 희망 시간</span>
                {selectedSlots.map((slotId, index) => <strong key={slotId}>{index + 1}. {formatSlot(slotId)}</strong>)}
              </div>
              <p className="booking-confirm-note">신청을 확정하면 운영자가 희망 시간 중 하나를 확인한 뒤 예약을 확정합니다.</p>
              <button className="btn btn-primary booking-confirm-button" onClick={() => void submit()} disabled={saving}>
                {saving ? '신청 저장 중...' : '예약 신청 확정'}
              </button>
            </section>
          )}
        </>
          ) : null}
          {currentRequest?.confirmed_slot_id && (
        <p className="alert alert-success">확정 슬롯: {currentRequest.confirmed_slot_id}</p>
          )}
        </main>
      </div>
    </div>
  );
};
