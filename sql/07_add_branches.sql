-- 체인 지점 매핑을 추가합니다.
-- 모든 지점은 동일한 슬롯을 공유하고, 신청에 선택 지점만 저장합니다.
BEGIN;

CREATE TABLE IF NOT EXISTS public.branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  station TEXT NOT NULL,
  is_virtual BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.branches (id, name, station, is_virtual)
VALUES
  ('kondae', '건대역지점', '건대입구역', true),
  ('gangnam', '강남지점', '신논현역', true),
  ('euljiro', '을지로지점', '을지로입구역', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  station = EXCLUDED.station,
  is_virtual = EXCLUDED.is_virtual;

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Branches readable to authenticated" ON public.branches;
CREATE POLICY "Branches readable to authenticated"
  ON public.branches FOR SELECT TO authenticated USING (true);

ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS branch_id TEXT;
UPDATE public.requests SET branch_id = 'kondae' WHERE branch_id IS NULL;
ALTER TABLE public.requests ALTER COLUMN branch_id SET DEFAULT 'kondae';
ALTER TABLE public.requests ALTER COLUMN branch_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'requests_branch_id_fkey'
      AND conrelid = 'public.requests'::regclass
  ) THEN
    ALTER TABLE public.requests
      ADD CONSTRAINT requests_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_requests_branch ON public.requests(branch_id);

CREATE OR REPLACE FUNCTION public.list_branches()
RETURNS TABLE (id TEXT, name TEXT, station TEXT, is_virtual BOOLEAN)
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT b.id, b.name, b.station, b.is_virtual
  FROM public.branches b
  ORDER BY CASE b.id WHEN 'kondae' THEN 1 WHEN 'gangnam' THEN 2 WHEN 'euljiro' THEN 3 ELSE 99 END
$$;
REVOKE ALL ON FUNCTION public.list_branches() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_branches() TO authenticated;
GRANT SELECT ON public.branches TO authenticated;

CREATE OR REPLACE FUNCTION private.submit_request_at_branch(
  p_customer_id TEXT,
  p_branch_id TEXT,
  p_slot_ids TEXT[],
  p_operation_id TEXT
)
RETURNS JSONB
SECURITY DEFINER SET search_path = '' LANGUAGE plpgsql AS $$
DECLARE
  v_result JSONB;
  v_request_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.branches WHERE id = p_branch_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unknown branch');
  END IF;

  v_result := private.submit_request(p_customer_id, p_slot_ids, p_operation_id);
  IF COALESCE((v_result->>'success')::boolean, false) AND v_result ? 'requestId' THEN
    v_request_id := (v_result->>'requestId')::uuid;
    UPDATE public.requests
    SET branch_id = p_branch_id, updated_at = NOW()
    WHERE id = v_request_id AND customer_id = auth.uid()::text;
  END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_request_at_branch(
  p_customer_id TEXT, p_branch_id TEXT, p_slot_ids TEXT[], p_operation_id TEXT
)
RETURNS JSONB
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.submit_request_at_branch(p_customer_id, p_branch_id, p_slot_ids, p_operation_id)
$$;
REVOKE ALL ON FUNCTION private.submit_request_at_branch(text, text, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.submit_request_at_branch(text, text, text[], text) TO authenticated;
REVOKE ALL ON FUNCTION public.submit_request_at_branch(text, text, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_request_at_branch(text, text, text[], text) TO authenticated;

CREATE OR REPLACE FUNCTION private.resubmit_request_at_branch(
  p_customer_id TEXT,
  p_branch_id TEXT,
  p_request_id UUID,
  p_slot_ids TEXT[],
  p_operation_id TEXT
)
RETURNS JSONB
SECURITY DEFINER SET search_path = '' LANGUAGE plpgsql AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.branches WHERE id = p_branch_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unknown branch');
  END IF;

  v_result := private.resubmit_request(p_customer_id, p_request_id, p_slot_ids, p_operation_id);
  IF COALESCE((v_result->>'success')::boolean, false) THEN
    UPDATE public.requests
    SET branch_id = p_branch_id, updated_at = NOW()
    WHERE id = p_request_id AND customer_id = auth.uid()::text;
  END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.resubmit_request_at_branch(
  p_customer_id TEXT, p_branch_id TEXT, p_request_id UUID, p_slot_ids TEXT[], p_operation_id TEXT
)
RETURNS JSONB
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.resubmit_request_at_branch(p_customer_id, p_branch_id, p_request_id, p_slot_ids, p_operation_id)
$$;
REVOKE ALL ON FUNCTION private.resubmit_request_at_branch(text, text, uuid, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.resubmit_request_at_branch(text, text, uuid, text[], text) TO authenticated;
REVOKE ALL ON FUNCTION public.resubmit_request_at_branch(text, text, uuid, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resubmit_request_at_branch(text, text, uuid, text[], text) TO authenticated;

CREATE OR REPLACE FUNCTION private.admin_request_overview_with_branch()
RETURNS TABLE (
  id UUID, customer_id TEXT, customer_email TEXT, version INTEGER,
  created_at TIMESTAMPTZ, status TEXT, confirmed_slot_id TEXT, branch_id TEXT
)
SECURITY DEFINER SET search_path = '' LANGUAGE sql AS $$
  SELECT r.id, r.customer_id, u.email::text, r.version, r.created_at,
    r.status, r.confirmed_slot_id, r.branch_id
  FROM public.requests r
  LEFT JOIN auth.users u ON u.id::text = r.customer_id
  WHERE (auth.jwt()::jsonb->'app_metadata'->>'role')::text = 'admin'
  ORDER BY r.created_at ASC
$$;

CREATE OR REPLACE FUNCTION public.admin_request_overview_with_branch()
RETURNS TABLE (
  id UUID, customer_id TEXT, customer_email TEXT, version INTEGER,
  created_at TIMESTAMPTZ, status TEXT, confirmed_slot_id TEXT, branch_id TEXT
)
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM private.admin_request_overview_with_branch()
$$;
REVOKE ALL ON FUNCTION private.admin_request_overview_with_branch() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.admin_request_overview_with_branch() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_request_overview_with_branch() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_request_overview_with_branch() TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
