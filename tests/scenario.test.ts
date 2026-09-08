import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { DatabaseManager } from '../src/utils/database';
import { OperationManager } from '../src/utils/operations';
import { getAllDates } from '../src/utils/constants';
import { SlotTable } from '../src/components/SlotTable';

describe('PRD 예약 시나리오 회귀 검사', () => {
  let db: DatabaseManager;
  let om: OperationManager;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-07T08:00:00+09:00'));
    db = new DatabaseManager();
    om = new OperationManager(db);
  });
  afterEach(() => vi.useRealTimers());

  it('6단계: 중복 대기, 수동 확정, 재선택, 마감 신청·확정 차단', async () => {
    const c01 = await om.submitRequest('C01', ['2026-09-09:am', '2026-09-09:pm'], 's1');
    const c02 = await om.submitRequest('C02', ['2026-09-09:am'], 's2');
    expect([c01.success, c02.success]).toEqual([true, true]);
    expect(db.getSlot('2026-09-09:am')?.status).toBe('available');
    expect((await om.confirmRequest(c01.requestId!, '2026-09-09:am', 'ADMIN', 'c1')).success).toBe(true);
    expect(om.getCustomerStatus('C02')[0].request.status).toBe('needs_reselection');
    expect((await om.resubmitRequest('C02', c02.requestId!, ['2026-09-10:am'], 'r1')).success).toBe(true);
    const current = om.getCustomerStatus('C02')[0];
    expect(current.request.status).toBe('received');
    expect(current.request.version).toBe(2);
    expect(current.candidates.map(c => c.slotId)).toEqual(['2026-09-10:am']);
    expect(current.history.map(c => c.slotId)).toEqual(['2026-09-09:am']);
    expect((await om.submitRequest('C03', ['2026-09-09:am'], 's3')).success).toBe(false);
    expect((await om.confirmRequest(c02.requestId!, '2026-09-09:am', 'ADMIN', 'c2')).success).toBe(false);
    expect((await om.confirmRequest(c02.requestId!, '2026-09-10:am', 'ADMIN', 'c3')).success).toBe(true);
  });

  it('9/9 오전 시작 직전에는 가능하고, 정확히 09:00 KST부터 신청·확정 불가', async () => {
    vi.setSystemTime(new Date('2026-09-09T08:59:59+09:00'));
    const request = await om.submitRequest('C01', ['2026-09-09:am'], 's1');
    expect(request.success).toBe(true);
    vi.setSystemTime(new Date('2026-09-09T09:00:00+09:00'));
    expect((await om.submitRequest('C02', ['2026-09-09:am'], 's2')).success).toBe(false);
    expect((await om.confirmRequest(request.requestId!, '2026-09-09:am', 'ADMIN', 'c1')).success).toBe(false);
    expect(om.getCustomerStatus('C01')[0].request.status).toBe('needs_reselection');
    expect((await om.resubmitRequest('C01', request.requestId!, ['2026-09-10:am'], 'r1')).success).toBe(true);
  });

  it('모든 후보 소진 전 재선택 금지', async () => {
    const request = await om.submitRequest('C01', ['2026-09-09:am'], 's1');
    expect((await om.resubmitRequest('C01', request.requestId!, ['2026-09-10:am'], 'r1')).success).toBe(false);
    expect(db.getRequest(request.requestId!)?.version).toBe(1);
  });

  it('재선택한 현재 버전도 소진되면 다시 재선택 필요', async () => {
    const a = await om.submitRequest('C01', ['2026-09-09:am'], 's1');
    const b = await om.submitRequest('C02', ['2026-09-09:am'], 's2');
    await om.confirmRequest(a.requestId!, '2026-09-09:am', 'ADMIN', 'c1');
    const c = await om.submitRequest('C03', ['2026-09-10:am'], 's3');
    await om.resubmitRequest('C02', b.requestId!, ['2026-09-10:am'], 'r1');
    expect(om.getAdminRequests().map(x => x.request.customerId)).toEqual(['C01', 'C03', 'C02']);
    await om.confirmRequest(c.requestId!, '2026-09-10:am', 'ADMIN', 'c3');
    expect(om.getCustomerStatus('C02')[0].request.status).toBe('needs_reselection');
  });

  it('42슬롯은 한국 날짜로 고정되고 기간 종료 후 달력과 시간 선택이 비활성화', () => {
    expect(getAllDates()).toEqual(Array.from({ length: 14 }, (_, i) => `2026-09-${String(i + 9).padStart(2, '0')}`));
    expect(db.getAllSlots()).toHaveLength(42);
    vi.setSystemTime(new Date('2026-09-22T18:00:00+09:00'));
    const html = renderToStaticMarkup(createElement(SlotTable, { slots: db.getState().slots, selectedSlots: [], onToggle: () => {}, mode: 'select' }));
    expect(html.match(/<button[^>]*calendar-day[^>]*disabled=""/g)).toHaveLength(30);
    expect(html.match(/<button[^>]*time-option[^>]*disabled=""/g)).toHaveLength(3);
  });
});
