-- 기존 3개 시간대 DB에 숫자 시간 슬롯을 추가합니다.
-- 기존 슬롯과 예약은 삭제하지 않으며, 실행 후 새 시간대는 9·10·11·13·14·15·16·17·19·20으로 표시됩니다.
BEGIN;

CREATE OR REPLACE FUNCTION private.slot_open(p_date text, p_time text, p_status text) RETURNS boolean
LANGUAGE sql STABLE SET search_path = '' AS $$
 SELECT p_status = 'available' AND
   (p_date || CASE p_time
     WHEN 'am' THEN 'T09:00:00+09:00'
     WHEN 'pm' THEN 'T13:00:00+09:00'
     WHEN 'evening' THEN 'T18:00:00+09:00'
     WHEN '09' THEN 'T09:00:00+09:00'
     WHEN '10' THEN 'T10:00:00+09:00'
     WHEN '11' THEN 'T11:00:00+09:00'
     WHEN '13' THEN 'T13:00:00+09:00'
     WHEN '14' THEN 'T14:00:00+09:00'
     WHEN '15' THEN 'T15:00:00+09:00'
     WHEN '16' THEN 'T16:00:00+09:00'
     WHEN '17' THEN 'T17:00:00+09:00'
     WHEN '19' THEN 'T19:00:00+09:00'
     WHEN '20' THEN 'T20:00:00+09:00'
   END)::timestamptz > private.reservation_now()
$$;
REVOKE ALL ON FUNCTION private.slot_open(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.slot_open(text,text,text) TO authenticated, anon;

INSERT INTO public.slots (id, date, time_label, status)
SELECT to_char(slot_date, 'YYYY-MM-DD') || ':' || time_label,
       to_char(slot_date, 'YYYY-MM-DD'),
       time_label,
       'available'
FROM generate_series(DATE '2026-09-09', DATE '2026-12-31', INTERVAL '1 day') AS dates(slot_date)
CROSS JOIN (VALUES ('09'), ('10'), ('11'), ('13'), ('14'), ('15'), ('16'), ('17'), ('19'), ('20')) AS times(time_label)
ON CONFLICT (id) DO NOTHING;

COMMIT;
