-- 기존 설치 DB의 관리자 초기화 RPC를 교체합니다.
-- SQL Editor에서 03_cancel_request.sql 다음에 실행하세요.
BEGIN;

CREATE OR REPLACE FUNCTION private.admin_reset_reservations()
RETURNS JSONB
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
  v_requests INTEGER;
  v_candidates INTEGER;
  v_confirmations INTEGER;
  v_logs INTEGER;
BEGIN
  IF COALESCE((auth.jwt()::jsonb->'app_metadata'->>'role')::text, '') <> 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  DELETE FROM public.confirmations;
  GET DIAGNOSTICS v_confirmations = ROW_COUNT;
  DELETE FROM public.candidates;
  GET DIAGNOSTICS v_candidates = ROW_COUNT;
  DELETE FROM public.operation_logs;
  GET DIAGNOSTICS v_logs = ROW_COUNT;
  DELETE FROM public.requests;
  GET DIAGNOSTICS v_requests = ROW_COUNT;
  UPDATE public.slots
  SET status = 'available', confirmed_by = NULL, confirmed_at = NULL, updated_at = NOW();

  RETURN jsonb_build_object(
    'success', true,
    'requests', v_requests,
    'candidates', v_candidates,
    'confirmations', v_confirmations,
    'logs', v_logs
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_reservations()
RETURNS JSONB
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT private.admin_reset_reservations() $$;
REVOKE ALL ON FUNCTION private.admin_reset_reservations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.admin_reset_reservations() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_reset_reservations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_reservations() TO authenticated;

COMMIT;

-- PostgREST가 새 RPC를 즉시 인식하도록 스키마 캐시를 갱신합니다.
NOTIFY pgrst, 'reload schema';