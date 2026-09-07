import { supabase } from './supabase';
import type { Slot, Request, Candidate } from '../types';

export async function syncToSupabase(
  slots: Record<string, Slot>,
  requests: Request[],
  candidates: Candidate[]
) {
  try {
    // Slots 동기화
    const slotsArray = Object.values(slots);
    if (slotsArray.length > 0) {
      await supabase.from('slots').upsert(
        slotsArray.map(s => ({
          id: s.id,
          date: s.date,
          time_label: s.timeLabel,
          status: s.status,
          confirmed_by: s.confirmedBy,
          confirmed_at: s.confirmedAt,
        })),
        { onConflict: 'id' }
      );
    }

    // Requests 동기화
    if (requests.length > 0) {
      await supabase.from('requests').upsert(
        requests.map(r => ({
          id: r.id,
          customer_id: r.customerId,
          version: r.version,
          created_at: r.createdAt,
          status: r.status,
          confirmed_slot_id: r.confirmedSlotId,
          confirmed_at: r.confirmedAt,
        })),
        { onConflict: 'id' }
      );
    }

    // Candidates 동기화
    if (candidates.length > 0) {
      await supabase.from('candidates').upsert(
        candidates.map(c => ({
          id: c.id,
          request_id: c.requestId,
          slot_id: c.slotId,
          priority: c.priority,
          version: c.version,
          queue_seq: c.queueSeq,
        })),
        { onConflict: 'id' }
      );
    }

    console.log('Supabase 동기화 완료');
    return true;
  } catch (error) {
    console.error('Supabase 동기화 실패:', error);
    return false;
  }
}
