-- 01_install.sql 설치 후 공개 슬롯 조회에서 permission denied for schema private가 발생할 때 적용.
-- 예약/슬롯 데이터 변경 없음. 업무 RPC 실행 권한은 anon에 부여하지 않습니다.
BEGIN;
GRANT USAGE ON SCHEMA private TO anon;
GRANT EXECUTE ON FUNCTION private.reservation_now() TO anon;
GRANT EXECUTE ON FUNCTION private.slot_open(text, text, text) TO anon;
COMMIT;
