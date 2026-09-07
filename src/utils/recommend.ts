import { TIME_SLOTS, getAllDates, generateSlotId, isSlotOpen } from './constants';

interface RecommendSlot {
  id: string;
  date: string;
  timeLabel: string;
  status: string;
  serverAvailable?: boolean;
}

export function recommendAlternativeSlots(
  slots: Record<string, RecommendSlot>,
  excludedSlotIds: string[],
  limit = 3
): string[] {
  const excluded = new Set(excludedSlotIds);
  return getAllDates()
    .flatMap(date => TIME_SLOTS.map(time => generateSlotId(date, time.label)))
    .filter(slotId => !excluded.has(slotId) && isSlotOpen(slots[slotId]))
    .slice(0, limit);
}
