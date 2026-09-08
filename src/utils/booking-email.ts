import type { SupabaseClient } from '@supabase/supabase-js';

export type BookingEmailEvent = 'submitted' | 'confirmed';

export async function sendBookingEmail(
  client: SupabaseClient,
  event: BookingEmailEvent,
  requestId: string,
  slotId?: string,
): Promise<void> {
  const { error } = await client.functions.invoke('send-booking-email', {
    body: { event, requestId, slotId },
  });

  if (error) {
    // Email delivery must not turn a completed reservation into a failed reservation.
    console.warn('[booking-email] 발송 실패:', error.message);
  }
}
