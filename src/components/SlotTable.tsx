import React from 'react';
import type { Slot } from '../types';
import { TIME_SLOTS, getAllDates, isSlotOpen } from '../utils/constants';

interface SlotTableProps {
  slots: Record<string, Slot>;
  selectedSlots: string[];
  onToggle: (slotId: string) => void;
  maxSelect?: number;
  mode: 'view' | 'select';
}

export const SlotTable: React.FC<SlotTableProps> = ({
  slots,
  selectedSlots,
  onToggle,
  maxSelect = 3,
  mode = 'view',
}) => {
  const dates = getAllDates();

  const formatDate = (date: string) => {
    const weekday = new Date(`${date}T00:00:00+09:00`).toLocaleDateString('ko-KR', {
      weekday: 'short',
      timeZone: 'Asia/Seoul',
    });
    return `${date.slice(5).replace('-', '/')} (${weekday})`;
  };

  return (
    <div className="availability-board" aria-label="예약 가능한 날짜와 시간">
      <div className="availability-heading">
        <div>
          <span className="eyebrow">September 2026</span>
          <h3>가능한 시간</h3>
        </div>
        {mode === 'select' && <span className="selection-count">{selectedSlots.length}/{maxSelect} 선택</span>}
      </div>
      <div className="availability-list">
        {dates.map(date => (
          <section className="availability-day" key={date}>
            <h4>{formatDate(date)}</h4>
            <div className="time-options">
              {TIME_SLOTS.map(timeSlot => {
                const slotId = `${date}:${timeSlot.label}`;
                const slot = slots[slotId];
                const isSelected = selectedSlots.includes(slotId);
                const isConfirmed = !isSlotOpen(slot);
                const priority = selectedSlots.indexOf(slotId) + 1;

                return mode === 'select' ? (
                  <button
                    className={`time-option${isSelected ? ' selected' : ''}`}
                    key={slotId}
                    type="button"
                    onClick={() => onToggle(slotId)}
                    disabled={isConfirmed || (!isSelected && selectedSlots.length >= maxSelect)}
                    aria-pressed={isSelected}
                  >
                    {isSelected && <span className="time-priority">{priority}</span>}
                    {timeSlot.displayLabel}
                    {isConfirmed && <small>마감</small>}
                  </button>
                ) : (
                  <span className={`time-option status-only${isConfirmed ? ' unavailable' : ''}`} key={slotId}>
                    {timeSlot.displayLabel}
                    <small>{isConfirmed ? '마감' : '가능'}</small>
                  </span>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};
