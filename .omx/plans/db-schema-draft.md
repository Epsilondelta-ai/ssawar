# ssawar DB 스키마 초안

작성일: 2025-02-14
상태: Draft v1

## 목적

이 문서는 `ssawar` MVP의 세션, 메시지, 참가 AI, 요약, 제목 상태를 저장하기 위한 데이터베이스 스키마 초안을 정의한다.

상위 입력 문서:
- [session-api-state-design.md](/home/pi/code/ssawar/.omx/plans/session-api-state-design.md)
- [ai-battle-mvp-plan.md](/home/pi/code/ssawar/.omx/plans/ai-battle-mvp-plan.md)

## 설계 원칙

1. 세션은 질문 없이 생성 가능해야 한다.
2. 세션 생성 직후 제목은 항상 `Untitled`다.
3. 제목 자동 생성과 유저 수동 수정을 둘 다 지원해야 한다.
4. 오케스트레이터는 참가 AI와 별도 슬롯으로 저장한다.
5. 참가 AI는 최대 16개까지 허용한다.
6. MVP는 public-state 중심으로 설계하고, private-state는 나중에 확장한다.

## 권장 저장소

- 관계형 DB: PostgreSQL
- 이유:
  - 세션/참가자/메시지/요약 관계가 명확함
  - 인덱스, 제약, enum, jsonb 활용이 좋음
  - title state / lifecycle state 같은 상태값 관리가 쉬움

## Enum 초안

### `session_lifecycle_state`
- `created`
- `idle`
- `running`
- `awaiting_model`
- `summarizing`
- `finished`
- `errored`

### `session_title_state`
- `untitled`
- `auto_generated`
- `user_edited`

### `session_visibility`
- `private`
- `link`
- `public`

### `message_role`
- `user`
- `orchestrator`
- `participant`
- `system`

### `message_status`
- `pending`
- `streaming`
- `completed`
- `failed`
- `timed_out`

## 테이블 개요

### 필수 테이블
- `sessions`
- `session_participants`
- `session_messages`
- `session_summaries`

### 선택 테이블
- `session_events`
- `session_title_history`

MVP에서는 필수 4개면 충분하다. 다만 운영/디버깅을 위해 `session_events`는 넣는 편이 좋다.

## Table 1. `sessions`

세션 메타데이터의 중심 테이블

### Columns
- `id` uuid pk
- `title` text not null default `'Untitled'`
- `title_state` session_title_state not null default `'untitled'`
- `lifecycle_state` session_lifecycle_state not null default `'created'`
- `orchestrator_model` text not null
- `visibility` session_visibility not null default `'private'`
- `max_turns` integer not null default `6`
- `auto_extend` boolean not null default `true`
- `stop_policy` text not null default `'default'`
- `stop_reason` text null
- `current_turn` integer not null default `0`
- `user_id` uuid null
- `created_at` timestamptz not null default `now()`
- `updated_at` timestamptz not null default `now()`
- `finished_at` timestamptz null
- `deleted_at` timestamptz null

### Constraints
- `max_turns >= 1`
- `title <> ''`

### Recommended Indexes
- `(user_id, updated_at desc)`
- `(visibility, updated_at desc)`
- `(lifecycle_state, updated_at desc)`
- `(created_at desc)`

## Table 2. `session_participants`

한 세션에 속한 참가 AI 목록

### Columns
- `id` uuid pk
- `session_id` uuid not null references `sessions(id)` on delete cascade
- `model_name` text not null
- `display_name` text not null
- `position` integer not null
- `is_active` boolean not null default `true`
- `joined_at` timestamptz not null default `now()`
- `last_message_at` timestamptz null

### Constraints
- `position >= 0`
- `(session_id, position)` unique
- `(session_id, model_name, position)` unique

### Business Rule
- application layer에서 세션당 participant count를 2~16으로 제한

### Recommended Indexes
- `(session_id, position asc)`
- `(session_id, is_active)`

## Table 3. `session_messages`

세션 내 대화와 시스템 메시지 타임라인

### Columns
- `id` uuid pk
- `session_id` uuid not null references `sessions(id)` on delete cascade
- `role` message_role not null
- `message_status` message_status not null default `'completed'`
- `speaker_model` text null
- `speaker_label` text null
- `content` text not null
- `turn_index` integer not null default `0`
- `sequence_in_turn` integer not null default `0`
- `parent_message_id` uuid null references `session_messages(id)` on delete set null
- `target_model` text null
- `response_ms` integer null
- `token_count_estimate` integer null
- `metadata` jsonb not null default `'{}'::jsonb
- `created_at` timestamptz not null default `now()`

### Constraints
- `content <> ''`
- `turn_index >= 0`
- `sequence_in_turn >= 0`

### Metadata Examples
- `{ "heatScore": 2, "noveltyScore": 1, "repetitionScore": 0 }`
- `{ "fallback": true, "timeoutType": "participant_hard_timeout" }`
- `{ "titleCandidate": true }`

### Recommended Indexes
- `(session_id, created_at asc)`
- `(session_id, turn_index asc, sequence_in_turn asc)`
- `(session_id, role)`

## Table 4. `session_summaries`

종료 후 만들어지는 요약/하이라이트 저장

### Columns
- `id` uuid pk
- `session_id` uuid not null unique references `sessions(id)` on delete cascade
- `headline` text not null
- `bullets` jsonb not null default `'[]'::jsonb`
- `highlights` jsonb not null default `'[]'::jsonb`
- `generated_by_model` text null
- `created_at` timestamptz not null default `now()`
- `updated_at` timestamptz not null default `now()`

### Recommended Indexes
- `(created_at desc)`

## Table 5. `session_events` (권장)

운영/디버깅/trace용 이벤트 로그

### Columns
- `id` uuid pk
- `session_id` uuid not null references `sessions(id)` on delete cascade
- `event_type` text not null
- `payload` jsonb not null default `'{}'::jsonb`
- `created_at` timestamptz not null default `now()`

### Event Examples
- `session_created`
- `title_auto_generated`
- `title_user_edited`
- `participant_timeout`
- `orchestrator_timeout`
- `session_finished`

### Recommended Indexes
- `(session_id, created_at asc)`
- `(event_type, created_at desc)`

## Table 6. `session_title_history` (선택)

제목 변경 이력 추적

### Columns
- `id` uuid pk
- `session_id` uuid not null references `sessions(id)` on delete cascade
- `old_title` text null
- `new_title` text not null
- `source` text not null
- `created_at` timestamptz not null default `now()`

### Source Examples
- `auto_generated`
- `user_edited`
- `admin_edited`

## DDL 예시

```sql
create type session_lifecycle_state as enum (
  'created',
  'idle',
  'running',
  'awaiting_model',
  'summarizing',
  'finished',
  'errored'
);

create type session_title_state as enum (
  'untitled',
  'auto_generated',
  'user_edited'
);

create type session_visibility as enum (
  'private',
  'link',
  'public'
);

create type message_role as enum (
  'user',
  'orchestrator',
  'participant',
  'system'
);

create type message_status as enum (
  'pending',
  'streaming',
  'completed',
  'failed',
  'timed_out'
);

create table sessions (
  id uuid primary key,
  title text not null default 'Untitled',
  title_state session_title_state not null default 'untitled',
  lifecycle_state session_lifecycle_state not null default 'created',
  orchestrator_model text not null,
  visibility session_visibility not null default 'private',
  max_turns integer not null default 6 check (max_turns >= 1),
  auto_extend boolean not null default true,
  stop_policy text not null default 'default',
  stop_reason text,
  current_turn integer not null default 0,
  user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  deleted_at timestamptz,
  check (title <> '')
);

create table session_participants (
  id uuid primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  model_name text not null,
  display_name text not null,
  position integer not null check (position >= 0),
  is_active boolean not null default true,
  joined_at timestamptz not null default now(),
  last_message_at timestamptz,
  unique (session_id, position)
);

create table session_messages (
  id uuid primary key,
  session_id uuid not null references sessions(id) on delete cascade,
  role message_role not null,
  message_status message_status not null default 'completed',
  speaker_model text,
  speaker_label text,
  content text not null check (content <> ''),
  turn_index integer not null default 0 check (turn_index >= 0),
  sequence_in_turn integer not null default 0 check (sequence_in_turn >= 0),
  parent_message_id uuid references session_messages(id) on delete set null,
  target_model text,
  response_ms integer,
  token_count_estimate integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table session_summaries (
  id uuid primary key,
  session_id uuid not null unique references sessions(id) on delete cascade,
  headline text not null,
  bullets jsonb not null default '[]'::jsonb,
  highlights jsonb not null default '[]'::jsonb,
  generated_by_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 무결성 규칙

### Application Layer Rules
- participant count는 2~16
- `user_edited` 상태의 제목은 자동 생성이 덮어쓰지 않음
- `finished` 세션에는 새 메시지 전송 불가
- 세션 생성 직후 `title = 'Untitled'`

### DB Layer Rules
- 빈 title 금지
- turn index 음수 금지
- participant position 중복 금지

## 쿼리 패턴

### 최근 세션 목록
```sql
select id, title, lifecycle_state, updated_at
from sessions
where user_id = $1 and deleted_at is null
order by updated_at desc
limit 30;
```

### 세션 메시지 로드
```sql
select *
from session_messages
where session_id = $1
order by turn_index asc, sequence_in_turn asc, created_at asc;
```

### 자동 제목 생성 대상 찾기
```sql
select id
from sessions
where title_state = 'untitled'
  and lifecycle_state in ('idle', 'running', 'awaiting_model')
  and deleted_at is null;
```

## 향후 확장 고려사항

### private-state 모드
- `session_private_state` 테이블 추가 가능
- participant별 hidden payload 저장 가능

### human multi-user
- `session_members`
- `message_reactions`
- `message_reads`

### streaming
- `message_chunks` 테이블은 MVP에선 불필요
- 필요 시 later add

## Acceptance Criteria

1. 세션은 `Untitled` 기본 제목으로 저장돼야 한다.
2. 세션은 오케스트레이터 모델 1개와 참가 AI 2~16개를 저장할 수 있어야 한다.
3. 메시지는 turn index와 순서를 복원할 수 있어야 한다.
4. 자동 생성 제목과 유저 수정 제목을 구분 저장할 수 있어야 한다.
5. 세션 요약은 본문 메시지와 별도 테이블에 저장돼야 한다.
6. 향후 private-state 모드 확장을 막지 않는 구조여야 한다.

## 다음 단계

이 문서 다음으로 가장 자연스러운 작업은 아래 둘 중 하나다.

1. ORM 스키마 초안 작성
2. 프론트엔드 상태 관리 구조 설계
