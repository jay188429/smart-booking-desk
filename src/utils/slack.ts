export type SlackBookingEvent = 'submitted' | 'reselected' | 'confirmed';

interface SlackDetails {
  requestId?: string;
  customerId?: string;
  branchName?: string;
  slotId?: string;
}

const labels: Record<SlackBookingEvent, string> = {
  submitted: '예약 신청 접수',
  reselected: '예약 시간 재선택',
  confirmed: '예약 확정',
};

export async function notifySlack(event: SlackBookingEvent, details: SlackDetails): Promise<void> {
  const webhookUrl = import.meta.env.VITE_SLACK_WEBHOOK_URL;
  if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/')) return;

  const lines = [
    `*${labels[event]}*`,
    details.requestId ? `신청 ID: ${details.requestId}` : '',
    details.customerId ? `고객: ${details.customerId}` : '',
    details.branchName ? `지점: ${details.branchName}` : '',
    details.slotId ? `시간: ${details.slotId}` : '',
  ].filter(Boolean);

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: lines.join('\n') }),
    });
  } catch (reason) {
    console.warn('[slack] 알림 전송 실패:', reason);
  }
}
