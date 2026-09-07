import { describe, expect, it } from 'vitest';
import { formatRemaining, getSlaState, getSlaText, SLA_DURATION_MS } from '../src/utils/sla';

const createdAt = '2026-09-07T10:00:00.000Z';
const deadline = new Date(createdAt).getTime() + SLA_DURATION_MS;

describe('2시간 SLA 표시', () => {
  it('접수 후 남은 시간을 표시한다', () => {
    expect(getSlaState(createdAt, 'received', deadline - 1000)).toBe('pending');
    expect(getSlaText(createdAt, 'received', deadline - 1000)).toBe('확정까지 00:00:01 남음');
  });

  it('정확히 2시간이 지나면 기한 초과로 표시한다', () => {
    expect(getSlaState(createdAt, 'received', deadline)).toBe('expired');
    expect(getSlaText(createdAt, 'received', deadline)).toBe('확정 기한 초과');
  });

  it('확정과 재선택 상태는 SLA 만료보다 우선한다', () => {
    expect(getSlaState(createdAt, 'confirmed', deadline + 1)).toBe('confirmed');
    expect(getSlaText(createdAt, 'confirmed', deadline + 1)).toBe('확정 완료');
    expect(getSlaState(createdAt, 'needs_reselection', deadline + 1)).toBe('reselection');
    expect(getSlaText(createdAt, 'needs_reselection', deadline + 1)).toBe('재선택 필요');
  });

  it('남은 시간을 시분초로 포맷한다', () => {
    expect(formatRemaining(3_723_000)).toBe('01:02:03');
  });
});
