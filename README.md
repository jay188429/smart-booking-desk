# cal.dudu - 예약 관리 시스템

Cal.com을 참고한 무디자인 기본 예약 도구입니다. 한국 시간 2026년 9월 9일부터 22일까지 14일간 42개 슬롯(일 3시간대)을 관리하는 고객-어드민 이원 시스템입니다.

> **주의**: cal.dudu-works.com은 가상의 서비스명이며 실제 도메인 연결·배포를 의미하지 않습니다.

## 기술 스택

- **프론트엔드**: React 18.3.1 + TypeScript 5.6.3
- **빌드**: Vite 5.2.0
- **테스트**: Vitest 1.6.0
- **데이터베이스**: Supabase (선택사항)
- **상태 관리**: localStorage (로컬 모드) / Supabase DB (Supabase 모드)

모든 의존성은 정확한 버전으로 고정되어 있습니다.

## 기본 사항

### 예약 기간 및 슬롯

- **예약 기간**: 2026-09-09 ~ 2026-09-22 (14일)
- **일일 슬롯**: 3개 (오전 09:00, 오후 13:00, 저녁 18:00)
- **총 슬롯**: 42개 (14일 × 3시간대)
- **슬롯당 확정 인원**: 1명 (희망은 여러 명 가능)

### 고객 워크플로우

1. **신청**: 1~3개의 희망 슬롯을 선택 (순서대로 우선순위 1·2·3)
2. **대기**: 어드민이 수동 확정할 때까지 대기 상태 유지
3. **확정 또는 재선택**:
   - 희망 슬롯 중 하나가 확정되면 예약 완료
   - 모든 희망이 마감되거나 시간이 지나면 재선택 필요 상태로 변경

### 어드민 워크플로우

1. **접수 목록 확인**: 고객의 신청들과 희망 슬롯 목록 조회
2. **수동 확정**: 고객의 원래 희망 중 하나를 선택해 확정
3. **영향 관리**: 확정되면 관련 다른 고객들의 상태가 자동으로 갱신됨
4. **기록 추적**: 모든 작업의 기록을 실행 로그로 확인

## 시작하기

### 1. 의존성 설치

```sh
npm ci
```

### 2. 개발 서버 실행

```sh
npm run dev
```

기본 주소: http://localhost:5187

### 3. 빌드

```sh
npm run build
```

### 4. 테스트

```sh
npm test
```

### 5. 타입 체크

```sh
npm run type-check
```

## 프로젝트 구조

```
src/
├── components/
│   ├── CustomerPage.tsx      # 고객 화면 (신청, 상태 확인)
│   ├── AdminPage.tsx         # 어드민 화면 (확정, 기록)
│   └── SlotTable.tsx         # 슬롯 표 (14행 × 3열)
├── pages/
│   └── App.tsx              # 메인 앱 컴포넌트
├── utils/
│   ├── constants.ts         # 기준 시각, 날짜 상수
│   ├── database.ts          # 데이터 관리 클래스
│   ├── decide.ts            # 후보 가용성 판정 로직
│   └── operations.ts        # 신청·확정·재선택 작업
├── types.ts                 # TypeScript 타입 정의
├── styles/
│   └── app.css             # 기본 CSS
├── fixtures/
│   └── slots.json          # 42개 슬롯 초기 데이터
└── main.tsx                # React 진입점

sql/
└── 00_supabase.sql         # Supabase 설치 스크립트 (테이블, 함수, 권한)

tests/
└── operations.test.ts      # 신청·확정·재선택 작업 테스트
```

## 핵심 데이터 모델

### Slot
```typescript
{
  id: string;                    // "2026-09-07:am" 형식
  date: string;                  // "2026-09-07"
  timeLabel: string;             // "am" | "pm" | "evening"
  status: 'available' | 'confirmed';
  confirmedAt?: string;          // ISO 8601
  confirmedBy?: string;          // 고객 코드
}
```

### Request
```typescript
{
  id: string;                    // UUID
  customerId: string;            // "C01" 등
  version: number;               // 재선택 시 증가
  createdAt: string;             // ISO 8601
  status: 'received' | 'needs_reselection' | 'confirmed';
  confirmedSlotId?: string;      // 어드민이 확정한 슬롯
  confirmedAt?: string;          // ISO 8601
}
```

### Candidate
```typescript
{
  id: string;                    // UUID
  requestId: string;             // 해당 신청
  slotId: string;               // 선택한 슬롯
  priority: number;             // 1 | 2 | 3 (우선순위)
  version: number;              // 재선택 이력 추적용
  queueSeq: number;             // 전체 제출 순번
}
```

### OperationLog
```typescript
{
  id: string;                    // UUID (재시도 식별용)
  timestamp: string;             // ISO 8601
  action: 'submit' | 'confirm' | 'reselect';
  requestId: string;             // 대상 신청
  adminId?: string;              // 어드민만 설정
  slotId?: string;              // 확정한 슬롯
  status: 'success' | 'failed';
  error?: string;               // 실패 이유
}
```

## 주요 로직

### 후보 가용성 판정 (`decide.ts`)

- 각 후보 슬롯의 현재 마감 여부 확인
- 우선순위 순서로 정렬 후 첫 번째 사용 가능 슬롯 식별
- 모든 후보가 마감되면 "재선택 필요" 상태로 전환

### 중복 확정 방지

- DB 제약: 슬롯당 최대 1개 확정만 허용
- 트랜잭션: 한 번의 확정 작업(검증·저장·상태 갱신)을 원자적으로 처리
- 안정적인 operation ID로 재시도 시 중복 방지

### 권한 관리

**로컬 모드**: 역할 전환 가능 (수업용 데모)
**Supabase 모드**: 실제 인증 및 DB 권한 적용
- 고객: 자신의 신청만 조회·제출 가능
- 어드민: 서버의 `app_metadata.role='admin'` 확인 후 확정 권한 부여

## 모드별 동작

### 로컬 모드
- 브라우저 localStorage 사용
- 진짜 인증이 아닌 수업용 데모
- 역할 전환 버튼으로 고객/어드민 전환 가능

### Supabase 모드 (구현 예정)
- 실제 데이터베이스 및 인증 적용
- Supabase Auth로 고객 로그인
- RPC 호출: `submit_request`, `confirm_request`, `resubmit_request`
- 환경 변수 설정 필요 (.env.local)

## 공통 시나리오

1. **초기 상태**: 42개 슬롯, 신청 0개
2. **고객 신청**:
   - C01: 9/9 오전, 9/9 오후 신청
   - C02: 9/9 오전 신청
3. **어드민 확정**:
   - C01의 9/9 오전 확정
   - C02는 자동으로 "재선택 필요" 상태로 변경
4. **재선택**:
   - C02: 9/10 오전 신청 (새 버전, 새 순번)
5. **다시 확정**:
   - C02의 9/10 오전 확정
6. **기록 확인**: 어드민 화면의 실행 기록에서 결과 확인

## 설정 및 상수

### 기준 시각
- 로컬 미리보기: 기기 시간 사용
- Supabase: 서버 시간 사용
- 자동 테스트: 시각 고정 (2026-09-09 09:00 KST)

지난 슬롯(시작 시각이 지난 슬롯)은 신청·확정할 수 없습니다.

### 한국 날짜 해석
모든 날짜는 OS 시간대와 무관하게 한국 시간대(Asia/Seoul)로 해석됩니다.

## Supabase SQL 설치

새 실습 프로젝트에서:

```sql
-- sql/00_supabase.sql 전체 붙여넣기
SELECT count(*) as slots, min(date) as first_day, max(date) as last_day FROM public.slots;
```

예상 결과: 42개 슬롯, 2026-09-09 ~ 2026-09-22

## 보호 사항

다음 항목들은 기본 실습에서 수정·재생성하지 않습니다:
- Supabase SQL 스키마 및 42슬롯 데이터
- 중복 확인 로직 및 DB 제약
- PRD의 기본값 (예약 기간, 슬롯 개수, 슬롯당 인원)

기능 변경은 해당 설정·코드·SQL·테스트·PRD가 일치해야 합니다.

## 파일 무결성 확인

기본 파일의 SHA256 해시를 [SHA256.json](SHA256.json)에 기록합니다.
변경 후 배포 기준선을 갱신할 때 사용합니다.

## 제약 및 범위

- CSS: 가독성 최소한만 (Tailwind, 아이콘, 애니메이션 없음)
- 자동 확정, 대기 수 제한, 알림, RAG, Agent, 결제, 취소: 기본에 없음
- 디자인 시스템, 차트, LLM 통합: 범위 외

## 참고 문서

- [AGENTS.md](AGENTS.md) - 구현 규칙 및 검사 기준
- [PRD.md](PRD.md) - 기본값 및 업무 정의
- [START_HERE.md](START_HERE.md) - 빠른 시작 가이드
- [.env.example](.env.example) - 환경 변수 템플릿

## 라이선스

교육용 기본 실습 자료입니다.
