# cal.dudu 시작하기

Node.js 22 LTS와 npm을 권장합니다. 예약 기간은 한국 시간 2026-09-09~22, 오전 09:00·오후 13:00·저녁 18:00, 총 42슬롯입니다.

## 실행

프로젝트 폴더에서 다음 명령을 순서대로 실행합니다. Windows PowerShell에서는 npm 대신 npm.cmd를 사용해도 됩니다.

```sh
npm ci
npm test
npm run build
npm run dev
```

터미널에 표시된 Local 주소를 엽니다. 기본 포트는 5187입니다. 환경 변수를 수정한 뒤에는 개발 서버를 종료하고 다시 실행합니다.

## 저장 모드 설정

`.env.example`을 참고하여 `.env` 또는 `.env.local`에 설정합니다. 새 배포본의 기본값은 local이며, 실제 저장은 명시적으로 supabase를 선택합니다.

```dotenv
VITE_APP_MODE=supabase
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

Supabase 프로젝트의 Connect/API 설정에서 Project URL과 anon 또는 publishable 공개 키를 확인합니다. service_role, secret key, DB 비밀번호는 브라우저 환경 변수에 넣지 않습니다. 환경 파일과 실제 계정은 Git/ZIP에 포함하지 않습니다.

상단 접속 모드 선택에서 **Supabase 실제 저장**을 선택하면 실제 로그인·DB 호출을 사용합니다. 설정 누락이나 연결 오류가 나도 로컬로 자동 전환하지 않습니다. **로컬 수업용 미리보기**는 기존 브라우저 데이터를 그대로 읽는 별도 모드입니다. 로컬 데이터는 Supabase로 자동 이전하지 않으며 초기화하지 않아도 모드를 바꿀 수 있습니다.

## SQL 설치

새 실습용 Supabase 프로젝트의 SQL Editor에서 다음 순서로 실행합니다.

1. `sql/01_install.sql`: 테이블·RPC·권한·42슬롯 설치. 예약과 슬롯을 삭제하지 않으며 이 파일의 재실행은 기존 데이터를 보존합니다.
2. `sql/02_public_slot_access.sql`: 공개 가용성 조회에 필요한 helper 접근 권한 보완. 예약 데이터나 업무 RPC 권한을 변경하지 않습니다.
3. `sql/03_cancel_request.sql`: 관리자가 확정하지 않은 신청을 취소하고 새로 신청할 수 있는 RPC를 추가합니다.

이미 01 설치를 마친 프로젝트에서 `permission denied for schema private`가 발생하면 **02만** 적용합니다. `sql/00_supabase.sql`은 이전 배포 원본 보존용이므로 실행하지 않습니다. 00으로 설치된 기존 DB에 01을 덧붙이는 방식은 지원하지 않습니다. 운영 DB 변경은 별도 검수 후 진행합니다.

```sql
select id, date, time_label, status, available
from public.slot_availability
order by id;
```

예상 결과는 42행입니다. 공개 슬롯 조회에는 고객 식별 정보가 없습니다. `tests/sql/*.sql`은 격리된 검사 DB 전용이며 실제 Supabase SQL Editor에 넣지 않습니다.

## 이메일 알림 설정

신청 접수·예약 확정 메일은 `supabase/functions/send-booking-email` Edge Function이 Resend를 통해 발송합니다. 예약 저장은 메일 서비스가 잠시 실패해도 성공으로 유지됩니다. 실제 메일 발송을 사용하려면 Supabase CLI로 함수를 배포하고 서버 비밀을 설정하세요.

```sh
supabase functions deploy send-booking-email
supabase secrets set RESEND_API_KEY=re_xxx RESEND_FROM_EMAIL=booking@example.com
```

`RESEND_FROM_EMAIL`은 Resend에서 인증한 발신 도메인의 주소여야 합니다. `SUPABASE_SERVICE_ROLE_KEY`는 Edge Function 내부의 Supabase 비밀값으로만 사용하며 브라우저 환경 변수에 넣지 않습니다.

## 실제 로그인 및 관리자 지정

이 앱은 이메일·비밀번호 로그인을 제공합니다. Supabase Authentication의 Users에서 실습 계정을 준비하고 이메일/비밀번호 로그인 공급자가 활성화되어 있는지 확인합니다. 이메일 확인이 필요한 계정은 확인을 완료해야 합니다. 계정 생성이나 비밀번호 변경은 Supabase에서 처리하며 앱은 로그인만 합니다.

고객은 C01 같은 임의 코드 대신 로그인한 Auth 사용자 UUID로 식별됩니다. 서로 다른 고객 실습에는 서로 다른 계정을 사용하세요.

관리자 지정은 Supabase 관리 권한이 있는 사람이 SQL Editor에서 해당 Auth 사용자 UUID를 확인한 뒤 실행합니다. 실제 UUID나 계정은 프로젝트 파일에 저장하지 않습니다.

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where id = '관리자로-지정할-사용자-UUID'::uuid;
```

관리자로 지정한 계정은 로그아웃 후 다시 로그인하여 새 토큰을 받아야 합니다. 앱은 `app_metadata.role`을 보고 관리자 화면을 표시하며 확정 권한은 DB에서도 검증합니다. `user_metadata`로 관리자 권한을 지정하지 않습니다.

## 실제 저장 확인

1. 고객 계정 1: 9/9 오전·오후 신청. `public.requests`, `public.candidates`에 저장됩니다.
2. 고객 계정 2: 9/9 오전 신청. 대기는 슬롯을 점유하지 않으므로 둘 다 접수됩니다.
3. 관리자: 고객 1의 9/9 오전을 선택하고 **확정 저장**. `public.confirmations`에 저장되고 requests 및 slots도 갱신됩니다.
4. 고객 2: 새로고침 또는 5초 자동 조회 후 재선택 안내를 확인하고 9/10 오전 재신청.
5. 마감된 9/9 오전에는 추가 신청·확정이 불가능합니다.

실제 저장 성공 후에만 화면에 **Supabase 접수/확정 저장 완료**가 표시됩니다. 조회·저장 실패는 오류로 표시합니다. 응답 유실 시 같은 입력 재시도에는 sessionStorage에 보존한 작업 ID를 사용합니다. 다른 브라우저/탭에서의 재시도 ID 공유는 지원하지 않습니다. 실습이 예약 시작 시각 이후라면 지난 시간을 선택할 수 없습니다.

## 첫 실행 프롬프트

```text
AGENTS.md, PRD.md, START_HERE.md를 읽어라. 제공된 42슬롯과 SQL 업무 규칙을 재생성하지 마라. 환경 변수의 비밀값을 출력하지 말고 접속 모드를 확인하라. npm test와 npm run build를 실행하고, 로컬 검사와 실제 Supabase 로그인·저장 검증을 구분해서 보고하라. 운영 DB를 초기화하지 마라.
```

## 파일과 무결성

`src/utils/reservation-api.ts`는 실제 DB 조회와 RPC 저장, 재시도 작업 ID를 관리합니다. `src/components/SupabaseApp.tsx`는 실제 로그인·고객 신청·관리자 확정 화면입니다. `src/utils/decide.ts`는 로컬 후보 가능 여부를 판정합니다. 기본값은 `src/utils/constants.ts`, 고정 데이터는 `src/fixtures/slots.json`, 실제 저장/중복 방지 규칙은 SQL에서 관리합니다.

```sh
node scripts/check-manifest.mjs
```

SHA256.json은 기존 배포 기준선이며 수정 파일을 검수 없이 통과시키기 위해 갱신하지 않습니다. 차이는 실패 종료 코드로 보고됩니다. 강사가 배포 원본과 수정본을 검수한 뒤 새 기준선을 별도로 배포합니다. 실제 검증 기록은 `VERIFICATION.md`를 참조하세요. 배포와 도메인 연결은 별도입니다.
