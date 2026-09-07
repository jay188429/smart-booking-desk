import { describe, expect, it } from 'vitest';
import { chooseAutoMatch } from '../src/utils/auto-match';

const candidates = [
  { requestId: 'c01', slotId: '09-am', priority: 1, queueSeq: 1, version: 1 },
  { requestId: 'c01', slotId: '09-pm', priority: 2, queueSeq: 2, version: 1 },
  { requestId: 'c02', slotId: '09-am', priority: 1, queueSeq: 3, version: 1 },
  { requestId: 'c02', slotId: '10-am', priority: 2, queueSeq: 4, version: 1 },
];

const requests = [
  { id: 'c01', status: 'received' as const },
  { id: 'c02', status: 'received' as const },
];

describe('규칙 기반 자동 매칭', () => {
  it('접수 순서와 희망 우선순위로 첫 매칭을 선택한다', () => {
    expect(chooseAutoMatch(requests, candidates, () => true)).toEqual({ requestId: 'c01', slotId: '09-am' });
  });

  it('마감 후보를 건너뛰고 다음 가용 후보를 선택한다', () => {
    expect(chooseAutoMatch(requests, candidates, slotId => slotId !== '09-am')).toEqual({ requestId: 'c01', slotId: '09-pm' });
  });

  it('첫 요청의 후보가 모두 마감되면 다음 요청을 선택한다', () => {
    expect(chooseAutoMatch(requests, candidates, slotId => slotId === '10-am')).toEqual({ requestId: 'c02', slotId: '10-am' });
  });
});
