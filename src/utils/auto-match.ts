export interface AutoMatchRequest {
  id: string;
  status: 'received' | 'needs_reselection' | 'confirmed';
}

export interface AutoMatchCandidate {
  requestId: string;
  slotId: string;
  priority: number;
  queueSeq: number;
  version: number;
}

export interface AutoMatchResult {
  requestId: string;
  slotId: string;
}

export function chooseAutoMatch(
  requests: AutoMatchRequest[],
  candidates: AutoMatchCandidate[],
  isAvailable: (slotId: string) => boolean
): AutoMatchResult | null {
  const eligibleRequests = requests
    .filter(request => request.status !== 'confirmed')
    .map(request => {
      const current = candidates
        .filter(candidate => candidate.requestId === request.id && candidate.version === getVersion(request, candidates))
        .sort((a, b) => a.priority - b.priority || a.queueSeq - b.queueSeq);
      return { request, current, firstQueueSeq: Math.min(...current.map(candidate => candidate.queueSeq)) };
    })
    .filter(item => item.current.length > 0)
    .sort((a, b) => a.firstQueueSeq - b.firstQueueSeq);

  for (const item of eligibleRequests) {
    const candidate = item.current.find(candidate => isAvailable(candidate.slotId));
    if (candidate) return { requestId: item.request.id, slotId: candidate.slotId };
  }
  return null;
}

function getVersion(request: AutoMatchRequest, candidates: AutoMatchCandidate[]): number {
  const versions = candidates
    .filter(candidate => candidate.requestId === request.id)
    .map(candidate => candidate.version);
  return versions.length ? Math.max(...versions) : 0;
}
