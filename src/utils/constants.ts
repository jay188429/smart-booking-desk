// 날짜 범위 (양끝 포함, 2026-09-09~2026-12-31, 한국 날짜)
export const START_DATE = new Date('2026-09-09T00:00:00+09:00');
export const END_DATE = new Date('2026-12-31T23:59:59+09:00');

// 예약 시간 (KST 기준). 달력에서는 오전·오후·저녁 3개 구역으로 묶어 표시합니다.
export const TIME_SLOTS = [
  { label: '09', hour: 9, period: 'am', displayLabel: '9' },
  { label: '10', hour: 10, period: 'am', displayLabel: '10' },
  { label: '11', hour: 11, period: 'am', displayLabel: '11' },
  { label: '13', hour: 13, period: 'pm', displayLabel: '13' },
  { label: '14', hour: 14, period: 'pm', displayLabel: '14' },
  { label: '15', hour: 15, period: 'pm', displayLabel: '15' },
  { label: '16', hour: 16, period: 'pm', displayLabel: '16' },
  { label: '17', hour: 17, period: 'pm', displayLabel: '17' },
  { label: '19', hour: 19, period: 'evening', displayLabel: '19' },
  { label: '20', hour: 20, period: 'evening', displayLabel: '20' },
];

export const TIME_GROUPS = [
  { label: '오전', period: 'am' },
  { label: '오후', period: 'pm' },
  { label: '저녁', period: 'evening' },
] as const;

// 총 슬롯 수 계산
export function calculateTotalSlots(): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((END_DATE.getTime() - START_DATE.getTime()) / msPerDay) + 1;
  return diffDays * TIME_SLOTS.length;
}

export const TOTAL_SLOTS = calculateTotalSlots(); // 114일 × 10개 시간 = 1140슬롯

// 슬롯 ID 생성
export function generateSlotId(dateStr: string, timeLabel: string): string {
  return `${dateStr}:${timeLabel}`;
}

// 슬롯 ID 파싱
export function parseSlotId(slotId: string): { date: string; timeLabel: string } | null {
  const match = slotId.match(/^(\d{4}-\d{2}-\d{2}):(\w+)$/);
  if (!match) return null;
  return { date: match[1], timeLabel: match[2] };
}

// 모든 날짜 배열 생성 (KST 기준)
export function getAllDates(): string[] {
  const dates: string[] = [];
  const kstOffset = 9 * 60 * 60 * 1000;
  const startKst = new Date(START_DATE.getTime() + kstOffset);
  const endKst = new Date(END_DATE.getTime() + kstOffset);
  const cursor = new Date(Date.UTC(startKst.getUTCFullYear(), startKst.getUTCMonth(), startKst.getUTCDate()));
  const end = Date.UTC(endKst.getUTCFullYear(), endKst.getUTCMonth(), endKst.getUTCDate());
  while (cursor.getTime() <= end) {
    dates.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-${String(cursor.getUTCDate()).padStart(2, '0')}`);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

// 모든 슬롯 생성 (초기값)
export function generateAllSlots() {
  const slots: Record<string, { date: string; timeLabel: string; status: 'available' }> = {};
  const dates = getAllDates();

  dates.forEach(date => {
    TIME_SLOTS.forEach(slot => {
      const slotId = generateSlotId(date, slot.label);
      slots[slotId] = {
        date,
        timeLabel: slot.label,
        status: 'available',
      };
    });
  });

  return slots;
}

// 한국 시간 오프셋을 명시하여 OS 시간대와 무관하게 시작 시각을 판정합니다.
export function isSlotOpen(slot: { date: string; timeLabel: string; status: string; serverAvailable?: boolean } | undefined, now = Date.now()): boolean {
  if (!slot || slot.status !== 'available') return false;
  if (typeof slot.serverAvailable === 'boolean') return slot.serverAvailable;
  const time = TIME_SLOTS.find(t => t.label === slot.timeLabel);
  return !!time && new Date(`${slot.date}T${String(time.hour).padStart(2, '0')}:00:00+09:00`).getTime() > now;
}
