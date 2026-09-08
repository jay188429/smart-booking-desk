-- 기존 01_install.sql 설치 DB에 미확정 신청 취소 RPC를 추가합니다.
-- Supabase SQL Editor에서 실행한 뒤 PostgREST 스키마를 갱신합니다.
BEGIN;

ALTER TABLE public.operation_logs DROP CONSTRAINT IF EXISTS operation_logs_action_check;
ALTER TABLE public.operation_logs
  ADD CONSTRAINT operation_logs_action_check
  CHECK (action IN ('submit', 'confirm', 'reselect', 'cancel'));

CREATE OR REPLACE FUNCTION private.cancel_request(
  p_customer_id TEXT,
  p_request_id UUID,
  p_operation_id TEXT
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
  v_request_status TEXT;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(20260909);

  IF auth.uid() IS NULL OR p_customer_id != auth.uid()::text THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.operation_logs
    WHERE operation_id = p_operation_id
      AND action = 'cancel'
      AND status = 'success'
      AND request_id = p_request_id
  ) THEN
    RETURN jsonb_build_object('success', true, 'requestId', p_request_id::text);
  END IF;

  SELECT status INTO v_request_status
  FROM public.requests
  WHERE id = p_request_id
    AND customer_id = auth.uid()::text
  FOR UPDATE;

  IF v_request_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found or not owner');
  END IF;

  IF v_request_status = 'confirmed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Confirmed request cannot be cancelled');
  END IF;

  INSERT INTO public.operation_logs (operation_id, action, request_id, status)
  VALUES (p_operation_id, 'cancel', p_request_id, 'success');

  DELETE FROM public.requests WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'requestId', p_request_id::text);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.operation_logs (operation_id, action, request_id, status, error_message)
  VALUES (p_operation_id, 'cancel', p_request_id, 'failed', SQLERRM);
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_request(
  p_customer_id TEXT,
  p_request_id UUID,
  p_operation_id TEXT
)
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$ SELECT private.cancel_request(p_customer_id, p_request_id, p_operation_id) $$;

REVOKE ALL ON FUNCTION private.cancel_request(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.cancel_request(text, uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.cancel_request(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_request(text, uuid, text) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
