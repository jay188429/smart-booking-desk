-- 새 실습 DB 설치: 01_install.sql만 실행. 기존 운영 DB에는 실행하지 않습니다.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
-- Supabase PostgreSQL 용
-- 한국 시간 2026-09-09~2026-09-22 14일, 매일 오전·오후·저녁 42슬롯


CREATE OR REPLACE FUNCTION private.reservation_now() RETURNS timestamptz
LANGUAGE sql STABLE SET search_path = '' AS $$ SELECT statement_timestamp() $$;
REVOKE ALL ON FUNCTION private.reservation_now() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.reservation_now() TO authenticated, anon;
CREATE OR REPLACE FUNCTION private.slot_open(p_date text, p_time text, p_status text) RETURNS boolean
LANGUAGE sql STABLE SET search_path = '' AS $$
 SELECT p_status = 'available' AND
   (p_date || CASE p_time WHEN 'am' THEN 'T09:00:00+09:00' WHEN 'pm' THEN 'T13:00:00+09:00' WHEN 'evening' THEN 'T18:00:00+09:00' END)::timestamptz > private.reservation_now()
$$;
REVOKE ALL ON FUNCTION private.slot_open(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.slot_open(text,text,text) TO authenticated, anon;
-- 1. 슬롯 테이블 (42개 고정)
CREATE TABLE IF NOT EXISTS slots (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  time_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'confirmed')),
  confirmed_by TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_slots_date_time ON public.slots(date, time_label);
CREATE INDEX IF NOT EXISTS idx_slots_date ON public.slots(date);
CREATE INDEX IF NOT EXISTS idx_slots_status ON public.slots(status);

ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Slots readable to all" ON public.slots;
CREATE POLICY "Slots readable to all"
  ON public.slots
  FOR SELECT
  USING (true);

-- 2. 신청 테이블
CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'needs_reselection', 'confirmed')),
  confirmed_slot_id TEXT REFERENCES public.slots(id),
  confirmed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requests_customer ON public.requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_created ON public.requests(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_requests_pending
  ON public.requests(customer_id) ;

ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Customers can view own requests" ON public.requests;
CREATE POLICY "Customers can view own requests"
  ON public.requests
  FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid()::text);

DROP POLICY IF EXISTS "Admins can view all requests" ON public.requests;
CREATE POLICY "Admins can view all requests"
  ON public.requests
  FOR SELECT
  USING (
    CASE 
      WHEN (auth.jwt()::jsonb->'app_metadata'->>'role')::text IS NOT NULL 
           AND (auth.jwt()::jsonb->'app_metadata'->>'role')::text = 'admin'
      THEN true
      ELSE false
    END
  );

-- 3. 희망 후보 테이블
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  slot_id TEXT NOT NULL REFERENCES public.slots(id),
  priority INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 3),
  version INTEGER NOT NULL,
  queue_seq INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_request_slot UNIQUE (request_id, version, slot_id)
);

CREATE INDEX IF NOT EXISTS idx_candidates_request ON public.candidates(request_id);
CREATE INDEX IF NOT EXISTS idx_candidates_slot ON public.candidates(slot_id);
CREATE INDEX IF NOT EXISTS idx_candidates_priority ON public.candidates(request_id, priority);
CREATE INDEX IF NOT EXISTS idx_candidates_queue ON public.candidates(queue_seq DESC);

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View candidates with request" ON public.candidates;
CREATE POLICY "View candidates with request"
  ON public.candidates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = candidates.request_id
        AND (r.customer_id = auth.uid()::text 
             OR (auth.jwt()::jsonb->'app_metadata'->>'role')::text = 'admin')
    )
  );

-- 4. 확정 기록 테이블
CREATE TABLE IF NOT EXISTS confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.requests(id),
  slot_id TEXT NOT NULL REFERENCES public.slots(id),
  admin_id TEXT NOT NULL,
  confirmed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_confirmations_request ON public.confirmations(request_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_confirmations_slot ON public.confirmations(slot_id);
CREATE INDEX IF NOT EXISTS idx_confirmations_admin ON public.confirmations(admin_id);

ALTER TABLE public.confirmations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Confirmations readable to authorized" ON public.confirmations;
CREATE POLICY "Confirmations readable to authorized"
  ON public.confirmations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = confirmations.request_id
        AND (r.customer_id = auth.uid()::text 
             OR (auth.jwt()::jsonb->'app_metadata'->>'role')::text = 'admin')
    )
  );

-- 5. 운영 로그 테이블
CREATE TABLE IF NOT EXISTS operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id TEXT UNIQUE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  action TEXT NOT NULL CHECK (action IN ('submit', 'confirm', 'reselect')),
  request_id UUID,
  admin_id TEXT,
  slot_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_operation ON public.operation_logs(operation_id);
CREATE INDEX IF NOT EXISTS idx_logs_action ON public.operation_logs(action);
CREATE INDEX IF NOT EXISTS idx_logs_request ON public.operation_logs(request_id);

ALTER TABLE public.operation_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Logs readable to authorized" ON public.operation_logs;
CREATE POLICY "Logs readable to authorized"
  ON public.operation_logs
  FOR SELECT
  USING (
    CASE
      WHEN (auth.jwt()::jsonb->'app_metadata'->>'role')::text = 'admin' THEN true
      ELSE false
    END
  );

-- ====================================================
-- 6. RPC: 신청 제출
-- ====================================================

CREATE OR REPLACE FUNCTION private.submit_request(
  p_customer_id TEXT,
  p_slot_ids TEXT[],
  p_operation_id TEXT
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
  v_request_id UUID;
  v_queue_seq INTEGER;
  i INTEGER;
  v_existing_request_id UUID;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(20260909);
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_customer_id != auth.uid()::text THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer ID mismatch');
  END IF;

  SELECT request_id INTO v_existing_request_id
  FROM public.operation_logs
  WHERE operation_id = p_operation_id AND status = 'success' AND action = 'submit' AND request_id IN (SELECT id FROM public.requests WHERE customer_id = auth.uid()::text)
  LIMIT 1;

  IF v_existing_request_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'requestId', v_existing_request_id::text);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.requests
    WHERE customer_id = p_customer_id
  ) THEN
    INSERT INTO public.operation_logs (operation_id, action, status, error_message)
    VALUES (p_operation_id, 'submit', 'failed', 'Pending request exists');
    RETURN jsonb_build_object('success', false, 'error', 'Customer already has a pending request');
  END IF;

  IF array_length(p_slot_ids, 1) IS NULL OR array_length(p_slot_ids, 1) < 1 OR array_length(p_slot_ids, 1) > 3 THEN
    INSERT INTO public.operation_logs (operation_id, action, status, error_message)
    VALUES (p_operation_id, 'submit', 'failed', 'Invalid slot count');
    RETURN jsonb_build_object('success', false, 'error', 'Select 1-3 slots');
  END IF;

  IF (SELECT count(DISTINCT x) FROM unnest(p_slot_ids) x) <> cardinality(p_slot_ids) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Duplicate slots');
  END IF;

  IF EXISTS (SELECT 1 FROM unnest(p_slot_ids) AS input(id) LEFT JOIN public.slots s ON s.id = input.id WHERE s.id IS NULL OR NOT private.slot_open(s.date, s.time_label, s.status)) THEN
    INSERT INTO public.operation_logs (operation_id, action, status, error_message)
    VALUES (p_operation_id, 'submit', 'failed', 'Slot confirmed');
    RETURN jsonb_build_object('success', false, 'error', 'Some slots are closed');
  END IF;

  BEGIN
    INSERT INTO public.requests (customer_id, version, status)
    VALUES (p_customer_id, 1, 'received')
    RETURNING id INTO v_request_id;

    SELECT COALESCE(MAX(queue_seq), 0) + 1 INTO v_queue_seq FROM public.candidates;

    FOR i IN 1..array_length(p_slot_ids, 1) LOOP
      INSERT INTO public.candidates (request_id, slot_id, priority, version, queue_seq)
      VALUES (v_request_id, p_slot_ids[i], i, 1, v_queue_seq + i - 1);
    END LOOP;

    INSERT INTO public.operation_logs (operation_id, action, request_id, status)
    VALUES (p_operation_id, 'submit', v_request_id, 'success');

    RETURN jsonb_build_object('success', true, 'requestId', v_request_id::text);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.operation_logs (operation_id, action, status, error_message)
    VALUES (p_operation_id, 'submit', 'failed', SQLERRM);
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
  END;
END;
$$;

-- ====================================================
-- 7. RPC: 어드민 확정
-- ====================================================

CREATE OR REPLACE FUNCTION private.confirm_request(
  p_request_id UUID,
  p_slot_id TEXT,
  p_admin_id TEXT,
  p_operation_id TEXT
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing_request_id UUID;
  v_request_status TEXT;
  v_slot_status TEXT;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(20260909);
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF COALESCE((auth.jwt()::jsonb->'app_metadata'->>'role')::text, '') != 'admin' THEN
    INSERT INTO public.operation_logs (operation_id, action, status, error_message)
    VALUES (p_operation_id, 'confirm', 'failed', 'Not admin');
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT request_id INTO v_existing_request_id
  FROM public.operation_logs
  WHERE operation_id = p_operation_id AND status = 'success' AND action = 'confirm' AND request_id = p_request_id
  LIMIT 1;

  IF v_existing_request_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'affectedRequests', ARRAY[]::UUID[]);
  END IF;

  SELECT status INTO v_request_status FROM public.requests WHERE id = p_request_id;
  IF v_request_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF v_request_status = 'confirmed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already confirmed');
  END IF;

  SELECT status INTO v_slot_status FROM public.slots WHERE id = p_slot_id;
  IF v_slot_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Slot not found');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.slots s WHERE s.id = p_slot_id AND private.slot_open(s.date, s.time_label, s.status)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Slot already confirmed');
  END IF;

  -- 현재 버전의 후보 확인
  IF NOT EXISTS (
    SELECT 1 FROM public.candidates
    WHERE request_id = p_request_id AND slot_id = p_slot_id AND version = (SELECT version FROM public.requests WHERE id = p_request_id)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not in current candidates');
  END IF;

  BEGIN
    UPDATE public.slots
    SET status = 'confirmed',
        confirmed_by = (SELECT customer_id FROM public.requests WHERE id = p_request_id),
        confirmed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_slot_id AND status = 'available';

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Slot already confirmed');
    END IF;

    UPDATE public.requests
    SET status = 'confirmed', confirmed_slot_id = p_slot_id, confirmed_at = NOW(), updated_at = NOW()
    WHERE id = p_request_id;

    INSERT INTO public.confirmations (request_id, slot_id, admin_id)
    VALUES (p_request_id, p_slot_id, p_admin_id);

    -- 현재 버전에서 available 슬롯이 없는 요청만 needs_reselection
    UPDATE public.requests
    SET status = 'needs_reselection', updated_at = NOW()
    WHERE id IN (
      SELECT DISTINCT r.id
      FROM public.requests r
      WHERE r.status IN ('received', 'needs_reselection') AND r.id != p_request_id
        AND EXISTS (
          SELECT 1 FROM public.candidates c
          WHERE c.request_id = r.id AND c.slot_id = p_slot_id AND c.version = r.version
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.candidates c2
          INNER JOIN public.slots s ON c2.slot_id = s.id
          WHERE c2.request_id = r.id AND c2.version = r.version AND private.slot_open(s.date, s.time_label, s.status)
        )
    );

    INSERT INTO public.operation_logs (operation_id, action, request_id, slot_id, admin_id, status)
    VALUES (p_operation_id, 'confirm', p_request_id, p_slot_id, p_admin_id, 'success');

    RETURN jsonb_build_object('success', true, 'affectedRequests', ARRAY[]::UUID[]);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Duplicate');
  WHEN OTHERS THEN
    INSERT INTO public.operation_logs (operation_id, action, request_id, slot_id, status, error_message)
    VALUES (p_operation_id, 'confirm', p_request_id, p_slot_id, 'failed', SQLERRM);
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
  END;
END;
$$;

-- ====================================================
-- 8. RPC: 재선택 제출
-- ====================================================

CREATE OR REPLACE FUNCTION private.resubmit_request(
  p_customer_id TEXT,
  p_request_id UUID,
  p_slot_ids TEXT[],
  p_operation_id TEXT
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
  v_request_status TEXT;
  v_new_version INTEGER;
  v_queue_seq INTEGER;
  i INTEGER;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(20260909);
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_customer_id != auth.uid()::text THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not owner');
  END IF;

  IF EXISTS (SELECT 1 FROM public.operation_logs l JOIN public.requests r ON r.id = l.request_id WHERE l.operation_id = p_operation_id AND l.action = 'reselect' AND l.status = 'success' AND r.customer_id = auth.uid()::text AND r.id = p_request_id) THEN
    RETURN jsonb_build_object('success', true, 'requestId', p_request_id::text);
  END IF;

  -- 소유자 + 상태 검증 (needs_reselection 상태만 재선택 가능)
  SELECT status INTO v_request_status FROM public.requests
  WHERE id = p_request_id AND customer_id = auth.uid()::text FOR UPDATE;

  IF v_request_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found or not owner');
  END IF;

  IF v_request_status = 'confirmed' OR EXISTS (SELECT 1 FROM public.candidates c JOIN public.slots s ON s.id = c.slot_id WHERE c.request_id = p_request_id AND c.version = (SELECT version FROM public.requests WHERE id = p_request_id) AND private.slot_open(s.date, s.time_label, s.status)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid request status');
  END IF;

  IF COALESCE(array_length(p_slot_ids, 1), 0) < 1 OR COALESCE(array_length(p_slot_ids, 1), 0) > 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Select 1-3 slots');
  END IF;

  -- 후보 중복 검증
  IF (SELECT COUNT(DISTINCT slot_id) FROM (SELECT UNNEST(p_slot_ids) AS slot_id) t) != array_length(p_slot_ids, 1) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Duplicate slots');
  END IF;

  IF EXISTS (SELECT 1 FROM unnest(p_slot_ids) AS input(id) LEFT JOIN public.slots s ON s.id = input.id WHERE s.id IS NULL OR NOT private.slot_open(s.date, s.time_label, s.status)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Some slots are closed');
  END IF;

  BEGIN
    -- 버전 증가
    v_new_version := (SELECT MAX(version) FROM public.candidates WHERE request_id = p_request_id) + 1;
    
    -- 상태 received로 갱신
    UPDATE public.requests
    SET status = 'received', version = v_new_version, updated_at = NOW()
    WHERE id = p_request_id;

    -- 새로운 버전의 후보 추가
    SELECT COALESCE(MAX(queue_seq), 0) + 1 INTO v_queue_seq FROM public.candidates;

    FOR i IN 1..array_length(p_slot_ids, 1) LOOP
      INSERT INTO public.candidates (request_id, slot_id, priority, version, queue_seq)
      VALUES (p_request_id, p_slot_ids[i], i, v_new_version, v_queue_seq + i - 1);
    END LOOP;

    INSERT INTO public.operation_logs (operation_id, action, request_id, status)
    VALUES (p_operation_id, 'reselect', p_request_id, 'success');

    RETURN jsonb_build_object('success', true, 'requestId', p_request_id::text);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.operation_logs (operation_id, action, request_id, status, error_message)
    VALUES (p_operation_id, 'reselect', p_request_id, 'failed', SQLERRM);
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
  END;
END;
$$;

-- ====================================================
-- 9. 권한
-- ====================================================

-- ====================================================
-- 10. 슬롯 데이터 (42개, ON CONFLICT DO NOTHING)
-- ====================================================

INSERT INTO public.slots (id, date, time_label, status)
VALUES
  ('2026-09-09:am', '2026-09-09', 'am', 'available'),
  ('2026-09-09:pm', '2026-09-09', 'pm', 'available'),
  ('2026-09-09:evening', '2026-09-09', 'evening', 'available'),
  ('2026-09-10:am', '2026-09-10', 'am', 'available'),
  ('2026-09-10:pm', '2026-09-10', 'pm', 'available'),
  ('2026-09-10:evening', '2026-09-10', 'evening', 'available'),
  ('2026-09-11:am', '2026-09-11', 'am', 'available'),
  ('2026-09-11:pm', '2026-09-11', 'pm', 'available'),
  ('2026-09-11:evening', '2026-09-11', 'evening', 'available'),
  ('2026-09-12:am', '2026-09-12', 'am', 'available'),
  ('2026-09-12:pm', '2026-09-12', 'pm', 'available'),
  ('2026-09-12:evening', '2026-09-12', 'evening', 'available'),
  ('2026-09-13:am', '2026-09-13', 'am', 'available'),
  ('2026-09-13:pm', '2026-09-13', 'pm', 'available'),
  ('2026-09-13:evening', '2026-09-13', 'evening', 'available'),
  ('2026-09-14:am', '2026-09-14', 'am', 'available'),
  ('2026-09-14:pm', '2026-09-14', 'pm', 'available'),
  ('2026-09-14:evening', '2026-09-14', 'evening', 'available'),
  ('2026-09-15:am', '2026-09-15', 'am', 'available'),
  ('2026-09-15:pm', '2026-09-15', 'pm', 'available'),
  ('2026-09-15:evening', '2026-09-15', 'evening', 'available'),
  ('2026-09-16:am', '2026-09-16', 'am', 'available'),
  ('2026-09-16:pm', '2026-09-16', 'pm', 'available'),
  ('2026-09-16:evening', '2026-09-16', 'evening', 'available'),
  ('2026-09-17:am', '2026-09-17', 'am', 'available'),
  ('2026-09-17:pm', '2026-09-17', 'pm', 'available'),
  ('2026-09-17:evening', '2026-09-17', 'evening', 'available'),
  ('2026-09-18:am', '2026-09-18', 'am', 'available'),
  ('2026-09-18:pm', '2026-09-18', 'pm', 'available'),
  ('2026-09-18:evening', '2026-09-18', 'evening', 'available'),
  ('2026-09-19:am', '2026-09-19', 'am', 'available'),
  ('2026-09-19:pm', '2026-09-19', 'pm', 'available'),
  ('2026-09-19:evening', '2026-09-19', 'evening', 'available'),
  ('2026-09-20:am', '2026-09-20', 'am', 'available'),
  ('2026-09-20:pm', '2026-09-20', 'pm', 'available'),
  ('2026-09-20:evening', '2026-09-20', 'evening', 'available'),
  ('2026-09-21:am', '2026-09-21', 'am', 'available'),
  ('2026-09-21:pm', '2026-09-21', 'pm', 'available'),
  ('2026-09-21:evening', '2026-09-21', 'evening', 'available'),
  ('2026-09-22:am', '2026-09-22', 'am', 'available'),
  ('2026-09-22:pm', '2026-09-22', 'pm', 'available'),
  ('2026-09-22:evening', '2026-09-22', 'evening', 'available')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.submit_request(p_customer_id text, p_slot_ids text[], p_operation_id text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT private.submit_request(p_customer_id, p_slot_ids, p_operation_id) $$;
REVOKE ALL ON FUNCTION private.submit_request(text, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.submit_request(text, text[], text) TO authenticated;
REVOKE ALL ON FUNCTION public.submit_request(text, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_request(text, text[], text) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_request(p_request_id uuid, p_slot_id text, p_admin_id text, p_operation_id text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT private.confirm_request(p_request_id, p_slot_id, p_admin_id, p_operation_id) $$;
REVOKE ALL ON FUNCTION private.confirm_request(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.confirm_request(uuid, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.confirm_request(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_request(uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.resubmit_request(p_customer_id text, p_request_id uuid, p_slot_ids text[], p_operation_id text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT private.resubmit_request(p_customer_id, p_request_id, p_slot_ids, p_operation_id) $$;
REVOKE ALL ON FUNCTION private.resubmit_request(text, uuid, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.resubmit_request(text, uuid, text[], text) TO authenticated;
REVOKE ALL ON FUNCTION public.resubmit_request(text, uuid, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resubmit_request(text, uuid, text[], text) TO authenticated;

-- 공개 조회는 고객 식별 정보를 제외하고, 업무 테이블 쓰기는 RPC로만 허용합니다.
REVOKE ALL ON public.slots, public.requests, public.candidates, public.confirmations, public.operation_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.requests, public.candidates, public.confirmations, public.operation_logs TO authenticated;
CREATE OR REPLACE VIEW public.slot_availability AS
SELECT id, date, time_label, status, private.slot_open(date, time_label, status) AS available FROM public.slots;
GRANT SELECT ON public.slot_availability TO anon, authenticated;
COMMIT;
