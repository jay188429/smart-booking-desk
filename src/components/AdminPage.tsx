import React, { useState, useEffect } from 'react';
import { SlotTable } from './SlotTable';
import type { Slot, Request, Candidate, OperationLog } from '../types';
import { OperationManager } from '../utils/operations';
import { DatabaseManager } from '../utils/database';
import { TIME_SLOTS, isSlotOpen } from '../utils/constants';
import { syncToSupabase } from '../utils/supabase-sync';
import { getSlaText } from '../utils/sla';
import { chooseAutoMatch } from '../utils/auto-match';

interface AdminPageProps {
  db: DatabaseManager;
  mode: 'local' | 'supabase';
}

export const AdminPage: React.FC<AdminPageProps> = ({ db, mode }) => {
  const [adminId] = useState<string>('ADMIN001');
  const [slots, setSlots] = useState<Record<string, Slot>>({});
  const [requests, setRequests] = useState<
    Array<{ request: Request; candidates: Candidate[]; decision: any }>
  >([]);
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [selectedSlotForConfirm, setSelectedSlotForConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [autoMatching, setAutoMatching] = useState(false);

  const om = new OperationManager(db);

  // 초기 로드
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSlots(db.getState().slots);
      setRequests(om.getAdminRequests());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [db]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const loadData = () => {
    const state = db.getState();
    setSlots(state.slots);
    setRequests(om.getAdminRequests());
    setLogs(state.logs || []);
    setError('');
    setSuccess('');
  };

  const handleConfirm = async () => {
    if (!selectedRequest || !selectedSlotForConfirm) {
      setError('요청과 슬롯을 선택하세요');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      console.log('확정 시작:', { selectedRequest, selectedSlotForConfirm, adminId });
      const operationId = `confirm-${selectedRequest}-${selectedSlotForConfirm}-${Date.now()}`;
      const result = await om.confirmRequest(
        selectedRequest,
        selectedSlotForConfirm,
        adminId,
        operationId
      );

      console.log('확정 결과:', result);

      if (result.success) {
        if (mode === 'supabase') {
          const state = db.getState();
          await syncToSupabase(state.slots, state.requests, state.candidates);
        }

        setSuccess(`확정되었습니다! 영향받은 요청: ${result.affectedRequests?.length || 0}건`);
        setSelectedRequest(null);
        setSelectedSlotForConfirm(null);
        setTimeout(() => loadData(), 500);
      } else {
        setError(result.error || '확정 실패');
      }
    } catch (err) {
      console.error('확정 오류:', err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAutoMatch = async () => {
    setAutoMatching(true);
    setError('');
    setSuccess('');
    let matched = 0;
    try {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const currentRequests = om.getAdminRequests();
        const match = chooseAutoMatch(
          currentRequests.map(item => ({ id: item.request.id, status: item.request.status })),
          currentRequests.flatMap(item => item.candidates.map(candidate => ({
            requestId: candidate.requestId,
            slotId: candidate.slotId,
            priority: candidate.priority,
            queueSeq: candidate.queueSeq,
            version: candidate.version,
          }))),
          slotId => isSlotOpen(db.getState().slots[slotId])
        );
        if (!match) break;
        const result = await om.confirmRequest(match.requestId, match.slotId, adminId, `auto-${match.requestId}-${match.slotId}-${Date.now()}`);
        if (!result.success) break;
        matched += 1;
      }
      setSuccess(matched ? `규칙 기반 자동 매칭 ${matched}건 완료` : '자동 매칭 가능한 신청이 없습니다.');
      loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setAutoMatching(false);
    }
  };

  const currentRequest = selectedRequest ? requests.find(r => r.request.id === selectedRequest) : null;

  return (
    <div className="admin-page">
      <h2>어드민 패널</h2>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      <button className="btn btn-primary" onClick={() => void handleAutoMatch()} disabled={autoMatching || loading}>
        {autoMatching ? '자동 매칭 중...' : '규칙 기반 자동 매칭'}
      </button>

      <div className="grid">
        {/* 요청 목록 */}
        <div>
          <h3>신청 목록 (총 {requests.length}건)</h3>
          <div style={{ maxHeight: '500px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
            <ul className="list" style={{ margin: 0 }}>
              {requests.map((item, idx) => (
                <li
                  key={item.request.id}
                  onClick={() => {
                    setSelectedRequest(item.request.id);
                    setSelectedSlotForConfirm(null);
                  }}
                  style={{
                    cursor: 'pointer',
                    background: selectedRequest === item.request.id ? '#e7f3ff' : 'white',
                    borderColor: selectedRequest === item.request.id ? '#007bff' : '#ddd',
                    marginBottom: '0',
                    borderRadius: '0',
                    borderBottom: '1px solid #ddd',
                  }}
                >
                  <div>
                    <strong>#{idx + 1}</strong> {item.request.customerId} (v
                    {item.request.version})
                    <br />
                    <span style={{ fontSize: '12px', color: '#666' }}>
                      {new Date(item.request.createdAt).toLocaleString()}
                    </span>
                    <br />
                    <span className={`slot-status ${item.request.status === 'confirmed' ? 'confirmed' : 'available'}`}>
                      {item.request.status === 'confirmed'
                        ? '확정됨'
                        : item.request.status === 'needs_reselection'
                          ? '재선택필요'
                          : '접수됨'}
                    </span>
                    <br />
                    <span className="sla-text">{getSlaText(item.request.createdAt, item.request.status, now)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 요청 상세 */}
        <div>
          <h3>요청 상세</h3>
          {currentRequest ? (
            <div style={{ padding: '16px', background: 'white', border: '1px solid #ddd', borderRadius: '4px' }}>
              <div className="form-group">
                <label>고객 코드</label>
                <input type="text" value={currentRequest.request.customerId} disabled />
              </div>

              <div className="form-group">
                <label>상태</label>
                <input
                  type="text"
                  value={
                    currentRequest.request.status === 'confirmed'
                      ? '확정됨'
                      : currentRequest.request.status === 'needs_reselection'
                        ? '재선택필요'
                        : '접수됨'
                  }
                  disabled
                />
                <small className="sla-text">{getSlaText(currentRequest.request.createdAt, currentRequest.request.status, now)}</small>
              </div>

              <div className="form-group">
                <label>희망 슬롯 (우선순위 순)</label>
                <ul className="list">
                  {currentRequest.candidates.map((c, idx) => {
                    const slot = slots[c.slotId];
                    const isAvailable = isSlotOpen(slot);
                    return (
                      <li
                        key={c.id}
                        onClick={() => {
                          if (isAvailable && currentRequest.request.status !== 'confirmed') {
                            setSelectedSlotForConfirm(c.slotId);
                          }
                        }}
                        style={{
                          cursor: isAvailable && currentRequest.request.status !== 'confirmed' ? 'pointer' : 'default',
                          background:
                            selectedSlotForConfirm === c.slotId
                              ? '#d4edda'
                              : isAvailable
                                ? 'white'
                                : '#f8d7da',
                          borderColor: selectedSlotForConfirm === c.slotId ? '#28a745' : '#ddd',
                        }}
                      >
                        <span>
                          {idx + 1}. {slot?.date} {TIME_SLOTS.find(t => t.label === slot?.timeLabel)?.displayLabel}
                          {' '}
                          <span style={{ marginLeft: '10px', fontSize: '12px' }}>
                            {isAvailable ? '(가능)' : '(마감)'}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {currentRequest.request.status === 'confirmed' && currentRequest.request.confirmedSlotId && (
                <div className="alert alert-success">
                  <strong>확정 완료</strong>
                  <br />
                  {slots[currentRequest.request.confirmedSlotId]?.date}{' '}
                  {TIME_SLOTS.find(t => t.label === slots[currentRequest.request.confirmedSlotId!]?.timeLabel)?.displayLabel}
                  <br />
                  {new Date(currentRequest.request.confirmedAt!).toLocaleString()}
                </div>
              )}

              {currentRequest.request.status !== 'confirmed' && (
                <button
                  className="btn btn-success"
                  onClick={handleConfirm}
                  disabled={!selectedSlotForConfirm || !isSlotOpen(slots[selectedSlotForConfirm]) || loading}
                  style={{ marginTop: '10px', width: '100%' }}
                >
                  {loading ? '처리 중...' : '확정'}
                </button>
              )}
            </div>
          ) : (
            <div style={{ padding: '16px', background: '#f0f0f0', borderRadius: '4px', color: '#666' }}>
              목록에서 요청을 선택하세요
            </div>
          )}
        </div>
      </div>

      {/* 슬롯 현황 */}
      <div style={{ marginTop: '40px' }}>
        <h3>슬롯 현황 (표시용)</h3>
        <SlotTable slots={slots} selectedSlots={[]} onToggle={() => {}} mode="view" />
      </div>

      {/* 실행 기록 */}
      <div style={{ marginTop: '40px' }}>
        <h3>실행 기록 (최근 20건)</h3>
        <div className="table-container">
          <table className="slots-table">
            <thead>
              <tr>
                <th>시간</th>
                <th>행위</th>
                <th>요청ID</th>
                <th>슬롯</th>
                <th>결과</th>
                <th>오류</th>
              </tr>
            </thead>
            <tbody>
              {logs
                .slice()
                .reverse()
                .slice(0, 20)
                .map(log => (
                  <tr key={log.id} style={{ fontSize: '12px' }}>
                    <td>{new Date(log.timestamp).toLocaleString()}</td>
                    <td>{log.action}</td>
                    <td style={{ fontSize: '10px', fontFamily: 'monospace' }}>
                      {log.requestId.substring(0, 8)}...
                    </td>
                    <td>{log.slotId ? log.slotId : '-'}</td>
                    <td>
                      <span style={{ color: log.status === 'success' ? '#28a745' : '#dc3545' }}>
                        {log.status === 'success' ? '성공' : '실패'}
                      </span>
                    </td>
                    <td style={{ color: '#dc3545' }}>{log.error ? log.error.substring(0, 30) : '-'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
