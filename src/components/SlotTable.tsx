import React, { useState } from 'react';
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
  const [selectedDate, setSelectedDate] = useState(dates[0]);
  const calendarDays = Array.from({ length: 30 }, (_, index) => `2026-09-${String(index + 1).padStart(2, '0')}`);
  const firstWeekday = new Date('2026-09-01T00:00:00+09:00').getDay();
  const selectedSlotsForDate = dates.includes(selectedDate) ? selectedDate : dates[0];

  const formatDate = (date: string) => {
    const weekday = new Date(`${date}T00:00:00+09:00`).toLocaleDateString('ko-KR', {
      weekday: 'short',
      timeZone: 'Asia/Seoul',
    });
    return `${date.slice(5).replace('-', '/')} (${weekday})`;
  };

  const formatSelectedSlot = (slotId: string) => {
    const [date, timeLabel] = slotId.split(':');
    const time = TIME_SLOTS.find(item => item.label === timeLabel);
    return `${date.slice(5).replace('-', '/')} · ${time?.displayLabel ?? timeLabel}`;
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
      <div className="calendar-selection-layout">
        <div className="calendar-grid" aria-label="2026년 9월 예약 날짜">
          {['일', '월', '화', '수', '목', '금', '토'].map(day => <span className="calendar-weekday" key={day}>{day}</span>)}
          {Array.from({ length: firstWeekday }, (_, index) => <span className="calendar-empty" key={`empty-${index}`} />)}
          {calendarDays.map(date => {
            const isBookableDate = dates.includes(date);
            const isSelected = selectedDate === date;
            const hasOpenSlot = TIME_SLOTS.some(timeSlot => isSlotOpen(slots[`${date}:${timeSlot.label}`]));
            return (
              <button
                className={`calendar-day${isSelected ? ' selected' : ''}${isBookableDate && hasOpenSlot ? ' available' : ''}`}
                key={date}
                type="button"
                onClick={() => { if (isBookableDate) setSelectedDate(date); }}
                disabled={!isBookableDate || !hasOpenSlot}
                aria-pressed={isSelected}
              >
                <span>{Number(date.slice(-2))}</span>
                {isBookableDate && (
                  <span className="calendar-slot-marks" aria-label="오전, 오후, 저녁 선택 표시">
                    {TIME_SLOTS.map(timeSlot => {
                      const slotId = `${date}:${timeSlot.label}`;
                      const slot = slots[slotId];
                      const chosen = selectedSlots.includes(slotId);
                      return <span className={`calendar-slot-mark ${isSlotOpen(slot) ? 'open' : 'closed'}${chosen ? ' chosen' : ''}`} key={slotId} title={`${timeSlot.displayLabel}${chosen ? ` 희망 ${selectedSlots.indexOf(slotId) + 1}` : ''}`} />;
                    })}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {mode === 'select' && (
          <aside className="selection-summary" aria-label="선택한 희망 시간">
            <div className="selection-summary-heading">
              <h4>선택한 시간</h4>
              <span>{selectedSlots.length}/{maxSelect}</span>
            </div>
            {selectedSlots.length === 0 ? (
              <p>달력에서 날짜를 고른 뒤 시간 버튼을 선택하세요.</p>
            ) : (
              <ol>
                {selectedSlots.map((slotId, index) => (
                  <li key={slotId}>
                    <span className="selection-rank">{index + 1}</span>
                    <strong>{formatSelectedSlot(slotId)}</strong>
                    <button type="button" onClick={() => onToggle(slotId)} aria-label={`${formatSelectedSlot(slotId)} 제거`}>×</button>
                  </li>
                ))}
              </ol>
            )}
          </aside>
        )}
      </div>
      <section className="availability-day selected-day">
        <div className="selected-day-heading">
          <h4>{formatDate(selectedSlotsForDate)}</h4>
          <span>{TIME_SLOTS.filter(timeSlot => isSlotOpen(slots[`${selectedSlotsForDate}:${timeSlot.label}`])).length}개 가능</span>
        </div>
        <div className="time-options">
          {TIME_SLOTS.map(timeSlot => {
            const slotId = `${selectedSlotsForDate}:${timeSlot.label}`;
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
    </div>
  );
};
