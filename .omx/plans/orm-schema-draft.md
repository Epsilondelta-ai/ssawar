# ssawar ORM 스키마 초안

작성일: 2025-02-14
상태: Draft v1

## 목적

이 문서는 [db-schema-draft.md](/home/pi/code/ssawar/.omx/plans/db-schema-draft.md)를 ORM 레벨 개념으로 옮긴 초안이다.

목표는 아래 3가지다.

1. 앱 코드가 어떤 모델을 직접 다루는지 정한다
2. 관계형 DB 스키마를 ORM 모델/관계로 매핑한다
3. 이후 Prisma, Drizzle, TypeORM 중 무엇을 쓰든 바로 옮길 수 있게 한다

## 전제

- 현재 저장소에는 앱 코드가 아직 없다
- 따라서 이 문서는 `ORM 중립적`으로 작성한다
- 예시는 TypeScript 친화적 ORM을 염두에 둔 형태다

## 핵심 모델

### Session
- 채팅 세션의 루트 엔터티
- 오케스트레이터 모델, 제목, 생명주기 상태, 공개 범위를 가진다

### SessionParticipant
- 세션에 참가하는 AI 모델
- 오케스트레이터와 분리된 참가자 슬롯

### SessionMessage
- 유저/오케스트레이터/참가 AI 메시지
- 턴 순서를 복원할 수 있어야 한다

### SessionSummary
- 세션 종료 후 생성된 요약/하이라이트

### SessionEvent
- 디버깅/관찰/운영용 이벤트 로그

### SessionTitleHistory
- 제목 자동 생성 및 유저 수정 이력

## Enum 모델

### SessionLifecycleState
- `created`
- `idle`
- `running`
- `awaiting_model`
- `summarizing`
- `finished`
- `errored`

### SessionTitleState
- `untitled`
- `auto_generated`
- `user_edited`

### SessionVisibility
- `private`
- `link`
- `public`

### MessageRole
- `user`
- `orchestrator`
- `participant`
- `system`

### MessageStatus
- `pending`
- `streaming`
- `completed`
- `failed`
- `timed_out`

## ORM 모델 정의 초안

### Session

```ts
type Session = {
  id: string
  title: string
  titleState: SessionTitleState
  lifecycleState: SessionLifecycleState
  orchestratorModel: string
  visibility: SessionVisibility
  maxTurns: number
  autoExtend: boolean
  stopPolicy: string
  stopReason: string | null
  currentTurn: number
  userId: string | null
  createdAt: Date
  updatedAt: Date
  finishedAt: Date | null
  deletedAt: Date | null

  participants?: SessionParticipant[]
  messages?: SessionMessage[]
  summary?: SessionSummary | null
  events?: SessionEvent[]
  titleHistory?: SessionTitleHistory[]
}
```

### SessionParticipant

```ts
type SessionParticipant = {
  id: string
  sessionId: string
  modelName: string
  displayName: string
  position: number
  isActive: boolean
  joinedAt: Date
  lastMessageAt: Date | null

  session?: Session
}
```

### SessionMessage

```ts
type SessionMessage = {
  id: string
  sessionId: string
  role: MessageRole
  messageStatus: MessageStatus
  speakerModel: string | null
  speakerLabel: string | null
  content: string
  turnIndex: number
  sequenceInTurn: number
  parentMessageId: string | null
  targetModel: string | null
  responseMs: number | null
  tokenCountEstimate: number | null
  metadata: Record<string, unknown>
  createdAt: Date

  session?: Session
  parentMessage?: SessionMessage | null
}
```

### SessionSummary

```ts
type SessionSummary = {
  id: string
  sessionId: string
  headline: string
  bullets: unknown[]
  highlights: unknown[]
  generatedByModel: string | null
  createdAt: Date
  updatedAt: Date

  session?: Session
}
```

### SessionEvent

```ts
type SessionEvent = {
  id: string
  sessionId: string
  eventType: string
  payload: Record<string, unknown>
  createdAt: Date

  session?: Session
}
```

### SessionTitleHistory

```ts
type SessionTitleHistory = {
  id: string
  sessionId: string
  oldTitle: string | null
  newTitle: string
  source: "auto_generated" | "user_edited" | "admin_edited"
  createdAt: Date

  session?: Session
}
```

## 관계 정의

### Session -> SessionParticipant
- one-to-many
- 세션은 여러 참가 AI를 가진다

### Session -> SessionMessage
- one-to-many
- 세션은 여러 메시지를 가진다

### Session -> SessionSummary
- one-to-one optional
- 종료 전까지는 없을 수 있다

### Session -> SessionEvent
- one-to-many

### Session -> SessionTitleHistory
- one-to-many

### SessionMessage -> SessionMessage
- self-reference optional
- 부모 메시지 추적 가능

## ORM 레벨 제약

### Session
- `title` 기본값은 `Untitled`
- `titleState` 기본값은 `untitled`
- `lifecycleState` 기본값은 `created`
- `visibility` 기본값은 `private`
- `maxTurns` 기본값은 `6`
- `autoExtend` 기본값은 `true`

### SessionParticipant
- `position`은 세션 내 unique
- participant count는 DB보다 application/service layer에서 2~16 강제

### SessionMessage
- `content`는 빈 문자열 금지
- `turnIndex`, `sequenceInTurn`는 0 이상

## 서비스 레이어 규칙

ORM만으로 해결하지 말고 서비스 레이어에서 강제할 규칙:

1. 세션 생성 시 participant 2~16 검증
2. 유저가 제목 수정 후 자동 제목 재생성 금지
3. `finished` 세션의 새 메시지 전송 차단
4. 첫 메시지 이후 제목 자동 생성 큐 등록
5. participant timeout 시 fallback 메시지 생성 여부 결정

## Prisma 스타일 스키마 예시

참고용이며 실제 채택은 미정이다.

```prisma
model Session {
  id                String                 @id @default(uuid())
  title             String                 @default("Untitled")
  titleState        SessionTitleState      @default(untitled)
  lifecycleState    SessionLifecycleState  @default(created)
  orchestratorModel String
  visibility        SessionVisibility      @default(private)
  maxTurns          Int                    @default(6)
  autoExtend        Boolean                @default(true)
  stopPolicy        String                 @default("default")
  stopReason        String?
  currentTurn       Int                    @default(0)
  userId            String?
  createdAt         DateTime               @default(now())
  updatedAt         DateTime               @updatedAt
  finishedAt        DateTime?
  deletedAt         DateTime?

  participants      SessionParticipant[]
  messages          SessionMessage[]
  summary           SessionSummary?
  events            SessionEvent[]
  titleHistory      SessionTitleHistory[]

  @@index([userId, updatedAt(sort: Desc)])
  @@index([visibility, updatedAt(sort: Desc)])
  @@index([lifecycleState, updatedAt(sort: Desc)])
}

model SessionParticipant {
  id            String   @id @default(uuid())
  sessionId     String
  modelName     String
  displayName   String
  position      Int
  isActive      Boolean  @default(true)
  joinedAt      DateTime @default(now())
  lastMessageAt DateTime?

  session       Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@unique([sessionId, position])
  @@index([sessionId, position])
}

model SessionMessage {
  id                 String        @id @default(uuid())
  sessionId          String
  role               MessageRole
  messageStatus      MessageStatus @default(completed)
  speakerModel       String?
  speakerLabel       String?
  content            String
  turnIndex          Int           @default(0)
  sequenceInTurn     Int           @default(0)
  parentMessageId    String?
  targetModel        String?
  responseMs         Int?
  tokenCountEstimate Int?
  metadata           Json          @default("{}")
  createdAt          DateTime      @default(now())

  session            Session       @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  parentMessage      SessionMessage? @relation("MessageThread", fields: [parentMessageId], references: [id], onDelete: SetNull)
  childMessages      SessionMessage[] @relation("MessageThread")

  @@index([sessionId, createdAt])
  @@index([sessionId, turnIndex, sequenceInTurn])
}
```

## Repository 경계

### SessionRepository
- create session
- get session by id
- update lifecycle/title/visibility

### SessionParticipantRepository
- bulk create participants
- list participants by session

### SessionMessageRepository
- append message
- list messages
- append fallback/system messages

### SessionSummaryRepository
- upsert summary
- get summary by session

### SessionEventRepository
- append event
- list events by session

## ORM 선택 가이드

### Prisma 장점
- 초기 생산성 높음
- relation 모델링 명확
- migration/seed 흐름이 쉽다

### Drizzle 장점
- SQL 제어권이 더 강함
- schema와 query가 더 가깝다
- 복잡한 PostgreSQL 기능 활용이 유리함

### 현재 권장
- 코드베이스가 비어 있는 상태라면 MVP는 `Prisma`가 더 빠르다
- SQL 제어를 우선시한다면 Drizzle도 가능

## Acceptance Criteria

1. ORM 모델은 DB 초안의 핵심 테이블을 모두 반영해야 한다.
2. 세션 제목/상태/오케스트레이터/참가자/메시지 관계를 ORM 레벨에서 표현할 수 있어야 한다.
3. title state와 lifecycle state를 enum으로 관리할 수 있어야 한다.
4. participant 2~16 검증 규칙은 서비스 레이어 책임으로 분리돼야 한다.
5. 자동 제목 생성과 유저 수정 제목을 구분 저장할 수 있어야 한다.

## 다음 단계

이 문서 다음으로 자연스러운 작업은 아래 둘 중 하나다.

1. 실제 Prisma schema 초안 작성
2. 프론트엔드 상태 관리 구조 설계
