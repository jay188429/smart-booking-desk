-- 격리된 Supabase PostgreSQL 이미지에 Auth 서비스 대신 JWT 조회 함수만 제공합니다.
-- 실제 로그인/토큰 검증 테스트가 아닙니다. 운영 DB에는 실행하지 않습니다.
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
