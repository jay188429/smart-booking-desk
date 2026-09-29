-- 지점의 지도 표시 좌표만 추가합니다. 예약·슬롯·신청 데이터는 변경하지 않습니다.
BEGIN;

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS latitude numeric(9,6),
  ADD COLUMN IF NOT EXISTS longitude numeric(9,6);

UPDATE public.branches
SET latitude = 37.540400, longitude = 127.069200
WHERE id = 'kondae';

UPDATE public.branches
SET latitude = 37.504500, longitude = 127.025700
WHERE id = 'gangnam';

UPDATE public.branches
SET latitude = 37.566000, longitude = 126.982700
WHERE id = 'euljiro';

CREATE OR REPLACE FUNCTION public.list_branches_with_coords()
RETURNS TABLE (
  id text,
  name text,
  station text,
  is_virtual boolean,
  latitude numeric,
  longitude numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT b.id, b.name, b.station, b.is_virtual, b.latitude, b.longitude
  FROM public.branches AS b
  ORDER BY b.id;
$$;

GRANT EXECUTE ON FUNCTION public.list_branches_with_coords() TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
