-- 01_install.sql을 설치한 비어 있는 검사 DB 전용. 모든 데이터/고정 시각은 롤백됩니다.
BEGIN;
CREATE OR REPLACE FUNCTION private.reservation_now() RETURNS timestamptz
LANGUAGE sql STABLE SET search_path = '' AS $$ SELECT '2026-09-07T08:00:00+09:00'::timestamptz $$;
DO $$
DECLARE
 c01 text := '00000000-0000-4000-8000-000000000001';
 c02 text := '00000000-0000-4000-8000-000000000002';
 c03 text := '00000000-0000-4000-8000-000000000003';
 a uuid; b uuid; c uuid; result jsonb;
BEGIN
 ASSERT (SELECT count(*) = 42 FROM public.slots), '42 slots';
 PERFORM set_config('request.jwt.claim.sub', c01, true);
 PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', c01)::text, true);
 result := public.submit_request(c01, ARRAY['2026-09-09:am','2026-09-09:pm'], 's1');
 ASSERT (result->>'success')::boolean, result::text;
 a := (result->>'requestId')::uuid;
 PERFORM set_config('request.jwt.claim.sub', c02, true);
 PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', c02)::text, true);
 result := public.submit_request(c02, ARRAY['2026-09-09:am'], 's2');
 ASSERT (result->>'success')::boolean, result::text;
 b := (result->>'requestId')::uuid;
 ASSERT (SELECT status = 'available' FROM public.slots WHERE id = '2026-09-09:am'), 'pending does not occupy';
 result := public.resubmit_request(c02, b, ARRAY['2026-09-10:am'], 'early');
 ASSERT NOT (result->>'success')::boolean, 'early reselection rejected';
 result := public.confirm_request(a, '2026-09-09:am', c02, 'not-admin');
 ASSERT NOT (result->>'success')::boolean, 'customer cannot confirm';
 PERFORM set_config('request.jwt.claims', jsonb_build_object('sub',c01,'app_metadata',jsonb_build_object('role','admin'))::text, true);
 result := public.confirm_request(a, '2026-09-09:am', c01, 'c1');
 ASSERT (result->>'success')::boolean, result::text;
 ASSERT (SELECT status = 'needs_reselection' FROM public.requests WHERE id=b), 'C02 reselection';
 PERFORM set_config('request.jwt.claim.sub', c02, true);
 PERFORM set_config('request.jwt.claims', jsonb_build_object('sub',c02)::text, true);
 result := public.resubmit_request(c02,b,ARRAY['2026-09-10:am'],'r1');
 ASSERT (result->>'success')::boolean, result::text;
 result := public.resubmit_request(c02,b,ARRAY['2026-09-10:am'],'r1');
 ASSERT (result->>'success')::boolean, result::text;
 ASSERT (SELECT status='received' AND version=2 FROM public.requests WHERE id=b), 'new version received, retry idempotent';
 ASSERT (SELECT count(*)=2 FROM public.candidates WHERE request_id=b), 'history preserved';
 PERFORM set_config('request.jwt.claim.sub', c03, true);
 PERFORM set_config('request.jwt.claims', jsonb_build_object('sub',c03)::text, true);
 result := public.submit_request(c03, ARRAY['2026-09-09:am'], 'closed-submit');
 ASSERT NOT (result->>'success')::boolean, 'closed submit rejected';
 result := public.submit_request(c03, ARRAY['2026-09-10:am'], 's3');
 ASSERT (result->>'success')::boolean, result::text;
 c := (result->>'requestId')::uuid;
 PERFORM set_config('request.jwt.claims', jsonb_build_object('sub',c01,'app_metadata',jsonb_build_object('role','admin'))::text, true);
 result := public.confirm_request(b, '2026-09-09:am', c01, 'closed-confirm');
 ASSERT NOT (result->>'success')::boolean, 'closed confirm rejected';
 result := public.confirm_request(c, '2026-09-10:am', c01, 'c3');
 ASSERT (result->>'success')::boolean, result::text;
 ASSERT (SELECT status='needs_reselection' FROM public.requests WHERE id=b), 'version 2 exhausted';
 ASSERT NOT has_table_privilege('authenticated','public.slots','UPDATE'), 'direct writes closed';
 ASSERT NOT has_table_privilege('anon','public.slots','SELECT'), 'no customer ids in public read';
 ASSERT NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.confirm_request(uuid,text,text,text)'::regprocedure), 'invoker wrapper';
 RAISE NOTICE 'PASS: six steps, current version, reselection retry and permissions';
END $$;
CREATE OR REPLACE FUNCTION private.reservation_now() RETURNS timestamptz
LANGUAGE sql STABLE SET search_path = '' AS $$ SELECT '2026-09-11T09:00:00+09:00'::timestamptz $$;
DO $$
DECLARE result jsonb;
BEGIN
 ASSERT NOT private.slot_open('2026-09-11','am','available'), 'exact start closed';
 ASSERT private.slot_open('2026-09-11','pm','available'), 'afternoon open';
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
 PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004"}',true);
 result := public.submit_request('00000000-0000-4000-8000-000000000004', ARRAY['2026-09-11:am'], 'expired');
 ASSERT NOT (result->>'success')::boolean, 'past submit rejected';
 RAISE NOTICE 'PASS: Korea start boundary';
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN ASSERT (SELECT count(*) FILTER (WHERE available IS NOT NULL) = 42 FROM public.slot_availability), 'public availability fields accessible'; END $$;
ROLLBACK;

-- 로컬 회귀 검사와 같은 9/9 09:00 KST 경계. 실제 authenticated 역할로 RPC 호출.
BEGIN;
CREATE OR REPLACE FUNCTION private.reservation_now() RETURNS timestamptz
LANGUAGE sql STABLE SET search_path = '' AS $$ SELECT '2026-09-09T08:59:59+09:00'::timestamptz $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004"}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE result jsonb; BEGIN
 result := public.submit_request('00000000-0000-4000-8000-000000000004',ARRAY['2026-09-09:am'],'boundary-before');
 ASSERT (result->>'success')::boolean, result::text;
END $$;
RESET ROLE;
CREATE OR REPLACE FUNCTION private.reservation_now() RETURNS timestamptz
LANGUAGE sql STABLE SET search_path = '' AS $$ SELECT '2026-09-09T09:00:00+09:00'::timestamptz $$;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000004","app_metadata":{"role":"admin"}}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE result jsonb; request_id uuid; BEGIN
 SELECT id INTO request_id FROM public.requests WHERE customer_id='00000000-0000-4000-8000-000000000004';
 result := public.confirm_request(request_id,'2026-09-09:am','ADMIN','boundary-confirm');
 ASSERT NOT (result->>'success')::boolean, 'past confirmation rejected';
 result := public.resubmit_request('00000000-0000-4000-8000-000000000004',request_id,ARRAY['2026-09-10:am'],'boundary-reselect');
 ASSERT (result->>'success')::boolean, result::text;
 RAISE NOTICE 'PASS: authenticated RPC, 9/9 09:00 KST confirmation boundary and expired reselection';
END $$;
ROLLBACK;
