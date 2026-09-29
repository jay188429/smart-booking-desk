-- 2026-09-09~2026-12-31 예약 슬롯 확장
-- 기존 예약·확정·신청은 변경하지 않고 누락된 슬롯만 추가합니다.

INSERT INTO public.slots (id, date, time_label, status)
SELECT to_char(slot_date, 'YYYY-MM-DD') || ':' || time_label,
       to_char(slot_date, 'YYYY-MM-DD'),
       time_label,
       'available'
FROM generate_series(DATE '2026-09-09', DATE '2026-12-31', INTERVAL '1 day') AS dates(slot_date)
CROSS JOIN (VALUES ('am'), ('pm'), ('evening')) AS times(time_label)
ON CONFLICT (id) DO NOTHING;
