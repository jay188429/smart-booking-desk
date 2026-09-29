import React, { useEffect, useState } from 'react';
import type { Slot } from '../types';
import { TIME_GROUPS, TIME_SLOTS, getAllDates, isSlotOpen } from '../utils/constants';

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
  const firstOpenDate = dates.find(date => TIME_SLOTS.some(item => isSlotOpen(slots[`${date}:${item.label}`]))) || dates[dates.length - 1];
  const [selectedDate, setSelectedDate] = useState(firstOpenDate);
  const calendarMonths = Array.from(new Set(dates.map(date => date.slice(0, 7)))).map(month => {
    const monthDates = dates.filter(date => date.startsWith(month));
    const firstDay = new Date(`${month}-01T00:00:00+09:00`);
    return {
      month,
      label: firstDay.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', timeZone: 'Asia/Seoul' }),
      firstWeekday: firstDay.getDay(),
      dates: monthDates,
    };
  });
  const firstOpenMonthIndex = Math.max(0, calendarMonths.findIndex(item => item.month === firstOpenDate.slice(0, 7)));
  const [currentMonthIndex, setCurrentMonthIndex] = useState(firstOpenMonthIndex);
  const activeDate = dates.includes(selectedDate) ? selectedDate : dates[0];

  useEffect(() => {
    const selectedDateHasOpenSlot = TIME_SLOTS.some(item => isSlotOpen(slots[`${selectedDate}:${item.label}`]));
    if (!selectedDateHasOpenSlot && firstOpenDate !== selectedDate) {
      setSelectedDate(firstOpenDate);
      setCurrentMonthIndex(firstOpenMonthIndex);
    }
  }, [firstOpenDate, firstOpenMonthIndex, selectedDate, slots]);

  const changeMonth = (nextIndex: number) => {
    const month = calendarMonths[nextIndex];
    if (!month) return;
    const monthOpenDate = month.dates.find(date => TIME_SLOTS.some(item => isSlotOpen(slots[`${date}:${item.label}`])));
    setCurrentMonthIndex(nextIndex);
    setSelectedDate(monthOpenDate || month.dates[0]);
  };

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
        {mode === 'select' && <span className="selection-count">{selectedSlots.length}/{maxSelect} 선택</span>}
      </div>
      <div className="calendar-selection-layout">
      <div className="calendar-months" aria-label="2026년 9월부터 12월까지 예약 날짜">
        {(() => {
          const { month, label, firstWeekday, dates: monthDates } = calendarMonths[currentMonthIndex];
          return <section className="calendar-month" key={month}>
          <div className="calendar-month-header">
            <button
              className="calendar-nav-button"
              type="button"
              onClick={() => changeMonth(currentMonthIndex - 1)}
              disabled={currentMonthIndex === 0}
              aria-label="이전 달"
            >
              ‹ 이전 달
            </button>
            <h4>{label}</h4>
            <button
              className="calendar-nav-button"
              type="button"
              onClick={() => changeMonth(currentMonthIndex + 1)}
              disabled={currentMonthIndex === calendarMonths.length - 1}
              aria-label="다음 달"
            >
              다음 달 ›
            </button>
          </div>
          <div className="calendar-grid">
            {['일', '월', '화', '수', '목', '금', '토'].map(day => <span className="calendar-weekday" key={day}>{day}</span>)}
            {Array.from({ length: firstWeekday }, (_, index) => <span className="calendar-empty" key={`empty-${month}-${index}`} />)}
            {monthDates.map(date => {
              const hasOpenSlot = TIME_SLOTS.some(item => isSlotOpen(slots[`${date}:${item.label}`]));
              const isSelected = activeDate === date;
              return (
                <button
                  className={`calendar-day${isSelected ? ' selected' : ''}${hasOpenSlot ? ' available' : ''}`}
                  key={date}
                  type="button"
                  onClick={() => setSelectedDate(date)}
                  disabled={!hasOpenSlot}
                  aria-pressed={isSelected}
                >
                  <span>{Number(date.slice(-2))}</span>
                  <span className="calendar-slot-marks">{TIME_GROUPS.map(group => {
                    const groupSlots = TIME_SLOTS.filter(item => item.period === group.period);
                    const open = groupSlots.some(item => isSlotOpen(slots[`${date}:${item.label}`]));
                    const chosen = groupSlots.some(item => selectedSlots.includes(`${date}:${item.label}`));
                    return <span className={`calendar-slot-mark ${open ? 'open' : 'closed'}${chosen ? ' chosen' : ''}`} key={group.period} />;
                  })}</span>
                </button>
              );
            })}
          </div>
          </section>;
        })()}
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
        <div className="time-groups">
          {TIME_GROUPS.map(group => (
            <div className="time-group" key={group.period}>
              <h5>{group.label}</h5>
              <div className="time-options">
                {TIME_SLOTS.filter(item => item.period === group.period).map(item => {
                  const slotId = `${activeDate}:${item.label}`;
                  const isSelected = selectedSlots.includes(slotId);
                  const isClosed = !isSlotOpen(slots[slotId]);
                  const priority = selectedSlots.indexOf(slotId) + 1;
                  return mode === 'select' ? (
                    <button className={`time-option${isSelected ? ' selected' : ''}`} key={slotId} type="button" onClick={() => onToggle(slotId)} disabled={isClosed || (!isSelected && selectedSlots.length >= maxSelect)} aria-pressed={isSelected}>
                      {isSelected && <span className="time-priority">{priority}</span>}{item.displayLabel}
                    </button>
                  ) : <span className={`time-option status-only${isClosed ? ' unavailable' : ''}`} key={slotId}>{item.displayLabel}</span>;
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
