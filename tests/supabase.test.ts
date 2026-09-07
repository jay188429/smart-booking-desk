import { describe, expect, it, vi } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isSlotOpen } from '../src/utils/constants';
import { makeClient, readSnapshot, writeReservation } from '../src/utils/reservation-api';

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
const slotRows = Array.from({length: 14}, (_, i) => ['am','pm','evening'].map(time => ({ id: `2026-09-${String(i+9).padStart(2,'0')}:${time}`, date: `2026-09-${String(i+9).padStart(2,'0')}`, time_label: time, status: 'available', available: true }))).flat();

describe('Supabase 연결 계약', () => {
  it('설정 누락과 서버 비밀 키를 거절하며 로컬 성공으로 바꾸지 않는다', () => {
    expect(() => makeClient({})).toThrow('설정');
    expect(() => makeClient({VITE_SUPABASE_URL:'https://example.supabase.co',VITE_SUPABASE_ANON_KEY:'sb_secret_not-a-real-key'})).toThrow('공개 키');
  });
  it('서버 가용성은 기기 시각에 영향받지 않는다', () => {
    expect(isSlotOpen({date:'2026-09-09',timeLabel:'am',status:'available',serverAvailable:true}, Date.UTC(2030,0,1))).toBe(true);
    expect(isSlotOpen({date:'2026-09-09',timeLabel:'am',status:'available',serverAvailable:false}, 0)).toBe(false);
  });
  it('고객 조회를 자기 신청과 그 후보로 제한하고 서버 응답을 변환한다', async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input)); calls.push(url.pathname + url.search);
      const data = url.pathname.endsWith('/slot_availability') ? slotRows : url.pathname.endsWith('/requests') ? [{id:'r1', customer_id:'C02',version:2,created_at:'2026-09-07',status:'received',confirmed_slot_id:null}] : [{id:'w1',request_id:'r1',slot_id:'2026-09-09:am',version:1,priority:1,queue_seq:1},{id:'w2',request_id:'r1',slot_id:'2026-09-10:am',version:2,priority:1,queue_seq:2}];
      return new Response(JSON.stringify(data), {status:200,headers:{'Content-Type':'application/json'}});
    });
    const client = createClient('https://example.supabase.co','test-key', {auth:{persistSession:false,autoRefreshToken:false}, global:{fetch:fetchMock}});
    const snapshot = await readSnapshot(client, 'C02', false);
    expect(calls.some(url => url.includes('customer_id=eq.C02'))).toBe(true);
    expect(calls.some(url => url.includes('request_id=in.'))).toBe(true);
    expect(calls.some(url => url.includes('operation_logs'))).toBe(false);
    expect(snapshot.requests[0].version).toBe(2);
    expect(snapshot.candidates).toHaveLength(2);
    expect(snapshot.slots['2026-09-10:am'].serverAvailable).toBe(true);
  });
  it('조회 오류는 빈 성공 목록으로 바꾸지 않는다', async () => {
    const client = createClient('https://example.supabase.co','test-key', {auth:{persistSession:false,autoRefreshToken:false}, global:{fetch:async () => new Response(JSON.stringify({message:'permission denied'}),{status:403,headers:{'Content-Type':'application/json'}})}});
    await expect(readSnapshot(client,'C01',false)).rejects.toThrow('슬롯 조회 실패');
  });
  it('저장 응답 유실 후 재시도에 동일 operation ID를 사용한다', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({data:null,error:{message:'network disconnected'}}).mockResolvedValueOnce({data:{success:true,requestId:'r1'},error:null});
    const client = {rpc} as unknown as SupabaseClient;
    const storage = memoryStorage();
    const payload = {p_customer_id:'C01',p_slot_ids:['2026-09-09:am','2026-09-09:pm']};
    await expect(writeReservation(client,'C01','submit_request',payload,storage)).rejects.toThrow('같은 입력');
    await expect(writeReservation(client,'C01','submit_request',payload,storage)).resolves.toMatchObject({requestId:'r1'});
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
    expect(rpc.mock.calls[0][0]).toBe('submit_request');
    expect(rpc.mock.calls[0][1]).toMatchObject(payload);
  });
  it.each(['resubmit_request','confirm_request'] as const)('%s 실패 응답은 성공으로 표시하지 않는다', async action => {
    const rpc = vi.fn().mockResolvedValue({data:{success:false,error:'Some slots are closed'},error:null});
    await expect(writeReservation({rpc} as unknown as SupabaseClient,'C02',action,{p_request_id:'r2'},memoryStorage())).rejects.toThrow('저장 거절');
    expect(rpc.mock.calls[0][0]).toBe(action);
  });
});
