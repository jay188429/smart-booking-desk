import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Slot } from '../types';
export interface Booking { id: string; customer_id: string; customer_email?: string | null; version: number; created_at: string; updated_at: string; confirmed_at: string | null; status: 'received' | 'needs_reselection' | 'confirmed'; confirmed_slot_id: string | null }
export interface Wish { id: string; request_id: string; slot_id: string; priority: number; version: number; queue_seq: number }
export interface Audit { id: string; operation_id: string; action: string; request_id: string | null; status: string; error_message: string | null }
export interface Snapshot { slots: Record<string, Slot>; requests: Booking[]; candidates: Wish[]; logs: Audit[] }
export interface PublicConfig { VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string; VITE_APP_MODE?: string }
interface SlotRow { id: string; date: string; time_label: string; status: Slot['status']; available: boolean }

export function makeClient(env: PublicConfig): SupabaseClient {
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !key || /your-project|your-anon-key/.test(`${url} ${key}`)) throw new Error('Supabase URL과 공개 키를 .env에 설정하세요.');
  if (!/^https:\/\//.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(url)) throw new Error('Supabase URL 형식이 올바르지 않습니다.');
  let publicKey = key.startsWith('sb_publishable_');
  try { publicKey ||= JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon'; } catch { /* publishable 키는 JWT가 아닙니다. */ }
  if (!publicKey) throw new Error('브라우저에는 anon 또는 publishable 공개 키만 설정하세요.');
  return createClient(url, key);
}
function queryError(label: string, error: { message: string } | null) {
  if (error) throw new Error(`${label}: ${error.message}`);
}
export async function readSnapshot(client: SupabaseClient, userId: string, admin: boolean): Promise<Snapshot> {
  const slotResult = await client.from('slot_availability').select('id,date,time_label,status,available').returns<SlotRow[]>();
  queryError('슬롯 조회 실패', slotResult.error);
  if (!slotResult.data || slotResult.data.length !== 42 || slotResult.data.some(s => typeof s.available !== 'boolean')) throw new Error('슬롯 설치 결과가 올바르지 않습니다. 42슬롯과 가용성 조회를 확인하세요.');
  const slots = Object.fromEntries(slotResult.data.map(s => [s.id, { id: s.id, date: s.date, timeLabel: s.time_label, status: s.status, serverAvailable: s.available }])) as Record<string, Slot>;
  let requestResult;
  if (admin) {
    const overviewResult = await client.rpc('admin_request_overview').returns<Booking[]>();
    if (!overviewResult.error) {
      requestResult = overviewResult;
    } else if (/admin_request_overview|schema cache|not find/i.test(overviewResult.error.message)) {
      requestResult = await client
        .from('requests')
        .select('id,customer_id,version,created_at,updated_at,confirmed_at,status,confirmed_slot_id')
        .returns<Booking[]>();
    } else {
      requestResult = overviewResult;
    }
  } else {
    requestResult = await client
      .from('requests')
      .select('id,customer_id,version,created_at,updated_at,confirmed_at,status,confirmed_slot_id')
      .eq('customer_id', userId)
      .returns<Booking[]>();
  }
  queryError('신청 조회 실패', requestResult.error);
  const requests = requestResult.data || [];
  let candidates: Wish[] = [];
  if (requests.length) {
    const result = await client.from('candidates').select('id,request_id,slot_id,priority,version,queue_seq').in('request_id', requests.map(r => r.id)).returns<Wish[]>();
    queryError('희망 조회 실패', result.error);
    candidates = result.data || [];
  }
  for (const request of requests) {
    const current = candidates.filter(c => c.request_id === request.id && c.version === request.version);
    if (request.status !== 'confirmed' && current.length && current.every(c => !slots[c.slot_id]?.serverAvailable)) request.status = 'needs_reselection';
  }
  const sequence = (r: Booking) => Math.min(...candidates.filter(c => c.request_id === r.id && c.version === r.version).map(c => c.queue_seq));
  requests.sort((a, b) => sequence(a) - sequence(b));
  let logs: Audit[] = [];
  if (admin) {
    const result = await client.from('operation_logs').select('id,operation_id,action,request_id,status,error_message').order('timestamp', { ascending: false }).limit(20).returns<Audit[]>();
    queryError('실행 기록 조회 실패', result.error);
    logs = result.data || [];
  }
  return { slots, requests, candidates, logs };
}
export type WriteAction = 'submit_request' | 'resubmit_request' | 'confirm_request' | 'cancel_request';
// 응답 유실 시에도 같은 입력의 재시도에 같은 ID를 사용하며 데모 데이터는 건드리지 않습니다.
export async function writeReservation(client: SupabaseClient, userId: string, action: WriteAction, payload: Record<string, unknown>, storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = sessionStorage) {
  const scope = `cal_dudu_rpc:${userId}:${action}:${JSON.stringify(payload)}`;
  let operationId = storage.getItem(scope);
  if (!operationId) { operationId = crypto.randomUUID(); storage.setItem(scope, operationId); }
  const { data, error } = await client.rpc(action, { ...payload, p_operation_id: operationId });
  if (error) throw new Error(`저장 응답을 확인하지 못했습니다. 같은 입력으로 재시도하세요. 작업 ID ${operationId}: ${error.message}`);
  if (!data || typeof data.success !== 'boolean') throw new Error(`저장 응답 형식 오류. 작업 ID ${operationId}`);
  if (!data.success) { storage.removeItem(scope); throw new Error(`저장 거절: ${data.error || '예약 상태를 다시 확인하세요.'} (작업 ID ${operationId})`); }
  storage.removeItem(scope);
  return { operationId, requestId: data.requestId as string | undefined };
}
