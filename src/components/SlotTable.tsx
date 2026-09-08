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
  const activeDate = dates.includes(selectedDate) ? selectedDate : dates[0];

  const formatDate = (date: string) => {
    const weekday = new Date(`${date}T00:00:00+09:00`).toLocaleDateString('ko-KR', {
      weekday: 'short',
      timeZone: 'Asia/Seoul',
    });
    return `${date.slice(5).replace('-', '/')} (${weekday})`;
  };

  const formatSelectedSlot = (slotId: string) => {
    const [date, label] = slotId.split(':');
    return `${date.slice(5).replace('-', '/')} · ${TIME_SLOTS.find(item => item.label === label)?.displayLabel || label}`;
  };

  return (
    <div className="availability-board" aria-label="예약 가능한 날짜와 시간">
      <div className="availability-heading">
        <div><span className="eyebrow">September 2026</span><h3>가능한 시간</h3></div>
        {mode === 'select' && <span className="selection-count">{selectedSlots.length}/{maxSelect} 선택</span>}
      </div>
      <div className="calendar-selection-layout">
      <div className="calendar-grid" aria-label="2026년 9월 예약 날짜">
        {['일', '월', '화', '수', '목', '금', '토'].map(day => <span className="calendar-weekday" key={day}>{day}</span>)}
        {Array.from({ length: firstWeekday }, (_, index) => <span className="calendar-empty" key={`empty-${index}`} />)}
        {calendarDays.map(date => {
          const isBookable = dates.includes(date);
          const hasOpenSlot = TIME_SLOTS.some(item => isSlotOpen(slots[`${date}:${item.label}`]));
          const isSelected = activeDate === date;
          return (
            <button
              className={`calendar-day${isSelected ? ' selected' : ''}${isBookable && hasOpenSlot ? ' available' : ''}`}
              key={date}
              type="button"
              onClick={() => { if (isBookable) setSelectedDate(date); }}
              disabled={!isBookable || !hasOpenSlot}
              aria-pressed={isSelected}
            >
              <span>{Number(date.slice(-2))}</span>
              {isBookable && <span className="calendar-slot-marks">{TIME_SLOTS.map(item => {
                const slotId = `${date}:${item.label}`;
                const open = isSlotOpen(slots[slotId]);
                const chosen = selectedSlots.includes(slotId);
                return <span className={`calendar-slot-mark ${open ? 'open' : 'closed'}${chosen ? ' chosen' : ''}`} key={slotId} />;
              })}</span>}
            </button>
          );
        })}
      </div>
      {mode === 'select' && (
        <aside className="selection-summary" aria-label="선택한 희망 시간">
          <div className="selection-summary-heading"><h4>선택한 시간</h4><span>{selectedSlots.length}/{maxSelect}</span></div>
          {selectedSlots.length === 0 ? <p>날짜를 고른 뒤 시간을 선택하세요.</p> : (
            <ol>{selectedSlots.map((slotId, index) => <li key={slotId}><span className="selection-rank">{index + 1}</span><strong>{formatSelectedSlot(slotId)}</strong><button type="button" onClick={() => onToggle(slotId)} aria-label={`${formatSelectedSlot(slotId)} 제거`}>×</button></li>)}</ol>
          )}
        </aside>
      )}
      </div>
      <section className="availability-day selected-day">
        <div className="selected-day-heading"><h4>{formatDate(activeDate)}</h4><span>{TIME_SLOTS.filter(item => isSlotOpen(slots[`${activeDate}:${item.label}`])).length}개 가능</span></div>
        <div className="time-options">
          {TIME_SLOTS.map(item => {
            const slotId = `${activeDate}:${item.label}`;
            const isSelected = selectedSlots.includes(slotId);
            const isClosed = !isSlotOpen(slots[slotId]);
            const priority = selectedSlots.indexOf(slotId) + 1;
            return mode === 'select' ? (
              <button className={`time-option${isSelected ? ' selected' : ''}`} key={slotId} type="button" onClick={() => onToggle(slotId)} disabled={isClosed || (!isSelected && selectedSlots.length >= maxSelect)} aria-pressed={isSelected}>
                {isSelected && <span className="time-priority">{priority}</span>}{item.displayLabel}{isClosed && <small>마감</small>}
              </button>
            ) : <span className={`time-option status-only${isClosed ? ' unavailable' : ''}`} key={slotId}>{item.displayLabel}<small>{isClosed ? '마감' : '가능'}</small></span>;
          })}
        </div>
      </section>
    </div>
  );
};
