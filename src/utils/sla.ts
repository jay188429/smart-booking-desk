export const SLA_DURATION_MS = 2 * 60 * 60 * 1000;

export type SlaState = 'pending' | 'confirmed' | 'expired' | 'reselection';

export function getSlaState(
  createdAt: string,
  status: 'received' | 'needs_reselection' | 'confirmed',
  now = Date.now()
): SlaState {
  if (status === 'confirmed') return 'confirmed';
  if (status === 'needs_reselection') return 'reselection';
  return new Date(createdAt).getTime() + SLA_DURATION_MS <= now ? 'expired' : 'pending';
}

export function getSlaDeadline(createdAt: string): number {
  return new Date(createdAt).getTime() + SLA_DURATION_MS;
}

export function formatRemaining(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function getSlaText(
  createdAt: string,
  status: 'received' | 'needs_reselection' | 'confirmed',
  now = Date.now()
): string {
  const state = getSlaState(createdAt, status, now);
  if (state === 'confirmed') return '확정 완료';
  if (state === 'reselection') return '재선택 필요';
  const remaining = getSlaDeadline(createdAt) - now;
  if (state === 'expired') return '확정 기한 초과';
  return `확정까지 ${formatRemaining(remaining)} 남음`;
}
