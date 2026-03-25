# ssawar 세션 API / 상태 전이 설계

작성일: 2025-02-14
상태: Draft v1

## 목적

이 문서는 `ssawar`의 채팅 세션 생성, 메시지 송수신, 오케스트레이터 동작, 제목 자동 생성, 세션 종료를 지원하는 API 계약과 상태 전이를 정의한다.

상위 입력 문서:
- [ai-battle-mvp-plan.md](/home/pi/code/ssawar/.omx/plans/ai-battle-mvp-plan.md)
- [session-creation-prd.md](/home/pi/code/ssawar/.omx/plans/session-creation-prd.md)
- [session-creation-wireframes.md](/home/pi/code/ssawar/.omx/plans/session-creation-wireframes.md)

## 설계 원칙

1. 세션은 질문 없이도 생성 가능해야 한다.
2. 생성 직후 세션 제목은 `Untitled`다.
3. 첫 메시지 이후 제목 자동 생성이 가능해야 한다.
4. 오케스트레이터 모델은 세션 생성 시 유저가 선택한다.
5. 참가 AI는 최대 16개까지 허용한다.
6. 오케스트레이터는 참가 AI와 분리된 별도 슬롯이다.
7. 프론트엔드는 polling 또는 streaming 둘 다 대응 가능해야 한다.

## 핵심 엔터티

### Session
- 하나의 채팅 세션
- 빈 상태로 먼저 생성 가능
- 이후 메시지가 쌓이며 오케스트레이션이 진행됨

### Participant
- 세션에 참가하는 AI
- 최대 16개
- 플레이어 역할

### Orchestrator
- 세션의 진행자
- 톤, 순서, 개입 시점, 요약, 제목 생성 보조를 담당

### Message
- 유저 / 참가 AI / 오케스트레이터가 남기는 메시지 단위

### Session Title State
- `untitled`
- `auto_generated`
- `user_edited`

## 세션 상태 모델

### Session Lifecycle State
- `created`
- `idle`
- `running`
- `awaiting_model`
- `summarizing`
- `finished`
- `errored`

### 상태 설명

#### `created`
- 세션이 생성되었지만 아직 화면 초기 데이터 로딩이 완전히 끝나지 않은 상태

#### `idle`
- 세션은 열렸지만 아직 첫 메시지가 없거나, 다음 입력을 기다리는 상태

#### `running`
- 오케스트레이터 또는 참가 AI 응답이 오가며 세션이 진행 중인 상태

#### `awaiting_model`
- 외부 모델 응답을 기다리는 상태
- UI에서는 `생각 중`, `계속 생성 중` 등을 표시

#### `summarizing`
- 세션 종료 또는 유저 정리 요청 후 요약/하이라이트 생성 중

#### `finished`
- 종료된 세션
- 읽기 가능, 공유 가능, 재개 가능 여부는 정책으로 분리

#### `errored`
- 외부 API 실패, 조합 불가, 복구 불가 timeout 등으로 정상 진행이 불가능한 상태

## 제목 상태 모델

### `untitled`
- 생성 직후 기본 상태
- 표시 제목은 `Untitled`

### `auto_generated`
- 대화 내용 기반 제목이 자동 생성된 상태

### `user_edited`
- 유저가 제목을 직접 수정한 상태
- 이후 자동 생성이 제목을 덮어쓰면 안 됨

## 세션 생성 API

### POST `/api/sessions`

세션을 생성한다.

#### Request
```json
{
  "orchestratorModel": "claude-sonnet-4-5",
  "participantModels": [
    "gpt-5.4",
    "claude-sonnet-4-5",
    "gemini-2.5-pro"
  ],
  "visibility": "private",
  "maxTurns": 6,
  "autoExtend": true,
  "stopPolicy": "default"
}
```

#### Rules
- `orchestratorModel` 필수
- `participantModels` 최소 2, 최대 16
- 세션 제목은 서버가 항상 `Untitled`로 생성
- `firstMessage`는 생성 API에 넣지 않는다

#### Response
```json
{
  "session": {
    "id": "sess_123",
    "title": "Untitled",
    "titleState": "untitled",
    "lifecycleState": "idle",
    "orchestratorModel": "claude-sonnet-4-5",
    "participantModels": [
      "gpt-5.4",
      "claude-sonnet-4-5",
      "gemini-2.5-pro"
    ],
    "visibility": "private",
    "maxTurns": 6,
    "autoExtend": true,
    "stopPolicy": "default",
    "createdAt": "2025-02-14T10:00:00Z"
  }
}
```

## 세션 조회 API

### GET `/api/sessions/:sessionId`

세션 메타데이터와 현재 상태를 조회한다.

#### Response
```json
{
  "session": {
    "id": "sess_123",
    "title": "창업 조언 배틀",
    "titleState": "auto_generated",
    "lifecycleState": "running",
    "orchestratorModel": "claude-sonnet-4-5",
    "participantModels": [
      "gpt-5.4",
      "claude-sonnet-4-5",
      "gemini-2.5-pro"
    ],
    "visibility": "private",
    "currentTurn": 3,
    "maxTurns": 6,
    "autoExtend": true,
    "stopReason": null,
    "createdAt": "2025-02-14T10:00:00Z",
    "updatedAt": "2025-02-14T10:02:20Z"
  }
}
```

## 메시지 목록 조회 API

### GET `/api/sessions/:sessionId/messages`

메시지 타임라인을 페이지네이션 또는 cursor 기반으로 반환한다.

#### Response
```json
{
  "messages": [
    {
      "id": "msg_1",
      "role": "orchestrator",
      "speakerModel": "claude-sonnet-4-5",
      "content": "오늘은 창업 조언을 주제로 보겠습니다.",
      "turnIndex": 0,
      "createdAt": "2025-02-14T10:00:10Z"
    },
    {
      "id": "msg_2",
      "role": "participant",
      "speakerModel": "gpt-5.4",
      "content": "먼저 고객 인터뷰부터 하세요.",
      "turnIndex": 1,
      "createdAt": "2025-02-14T10:00:22Z"
    }
  ],
  "nextCursor": null
}
```

## 유저 메시지 전송 API

### POST `/api/sessions/:sessionId/messages`

유저 메시지를 전송하고 세션을 진행시킨다.

#### Request
```json
{
  "content": "창업을 한다면 무엇부터 해야 할까?"
}
```

#### Rules
- 빈 문자열 불가
- 세션이 `finished`면 기본적으로 전송 불가
- 첫 메시지일 경우 제목 자동 생성 작업을 큐에 넣을 수 있다

#### Response
```json
{
  "message": {
    "id": "msg_user_1",
    "role": "user",
    "content": "창업을 한다면 무엇부터 해야 할까?",
    "turnIndex": 0,
    "createdAt": "2025-02-14T10:00:05Z"
  },
  "session": {
    "id": "sess_123",
    "lifecycleState": "awaiting_model"
  }
}
```

## 제목 수정 API

### PATCH `/api/sessions/:sessionId/title`

유저가 제목을 직접 수정한다.

#### Request
```json
{
  "title": "창업 조언 토론"
}
```

#### Rules
- 빈 문자열 불가
- 성공 시 `titleState`를 `user_edited`로 변경
- 이후 자동 제목 생성이 덮어쓰면 안 됨

#### Response
```json
{
  "session": {
    "id": "sess_123",
    "title": "창업 조언 토론",
    "titleState": "user_edited",
    "updatedAt": "2025-02-14T10:03:00Z"
  }
}
```

## 세션 종료 API

### POST `/api/sessions/:sessionId/end`

유저가 세션 종료를 요청한다.

#### Request
```json
{
  "reason": "user_requested"
}
```

#### Response
```json
{
  "session": {
    "id": "sess_123",
    "lifecycleState": "summarizing"
  }
}
```

## 세션 요약 조회 API

### GET `/api/sessions/:sessionId/summary`

종료 후 생성된 세션 요약을 조회한다.

#### Response
```json
{
  "summary": {
    "headline": "창업 조언을 두고 세 모델이 상반된 우선순위를 제시했다.",
    "bullets": [
      "GPT-5.4는 고객 인터뷰를 우선시했다.",
      "Claude는 유통 구조를 먼저 정해야 한다고 봤다.",
      "Gemini는 시장 정의가 선행되어야 한다고 주장했다."
    ],
    "highlights": [
      {
        "messageId": "msg_9",
        "speakerModel": "gemini-2.5-pro",
        "content": "둘 다 틀렸고, 시장 정의가 먼저다."
      }
    ],
    "stopReason": "user_requested"
  }
}
```

## 제목 자동 생성 트리거

### 생성 조건
- 첫 유의미한 유저 메시지 이후
- 또는 대화 메시지 2~3개 누적 이후

### 실행 조건
- 현재 `titleState == untitled`
- 유저가 제목을 수정하지 않은 상태

### 실행 결과
- 성공 시 `titleState = auto_generated`
- 실패 시 제목은 `Untitled` 유지

## 실시간 업데이트 방식

### 옵션 A. Polling
- MVP 기본 권장
- 프론트는 2~3초 간격으로 세션 상태와 메시지를 갱신

### 옵션 B. SSE
- 메시지 추가와 상태 변화를 서버에서 푸시
- 채팅 UX가 좋아지지만 운영 복잡도가 오른다

### 권장안
- MVP는 polling
- 메시지량이 커지면 SSE로 확장

## 상태 전이

### 세션 생성
`created -> idle`

### 첫 메시지 전송
`idle -> awaiting_model -> running`

### 참가 AI 응답 중
`running <-> awaiting_model`

### 유저가 종료 클릭
`running -> summarizing -> finished`

### 복구 가능한 모델 지연
`awaiting_model -> running`

### 복구 불가 실패
`awaiting_model -> errored`

## 제목 상태 전이

`untitled -> auto_generated`

`untitled -> user_edited`

`auto_generated -> user_edited`

`user_edited`는 terminal state로 본다.

## Timeout / Fallback 정책

### Participant
- warning threshold: 12초
- hard timeout: 45초
- timeout 시:
  - 해당 턴 건너뛰기
  - fallback 멘트 사용
  - 세션 전체는 계속 진행

### Orchestrator
- warning threshold: 20초
- hard timeout: 90초
- timeout 시:
  - `계속 생성 중` 상태 유지
  - 백그라운드 처리 또는 재시도
  - 완전 실패 시 `errored`

## 오류 응답 규격

### 공통 에러 형식
```json
{
  "error": {
    "code": "INVALID_PARTICIPANT_COUNT",
    "message": "participantModels must contain between 2 and 16 models"
  }
}
```

### 대표 에러 코드
- `INVALID_ORCHESTRATOR_MODEL`
- `INVALID_PARTICIPANT_COUNT`
- `DUPLICATE_PARTICIPANT_MODEL`
- `SESSION_NOT_FOUND`
- `SESSION_FINISHED`
- `TITLE_ALREADY_LOCKED`
- `MODEL_TIMEOUT`
- `UPSTREAM_PROVIDER_ERROR`

## 데이터 모델 초안

### sessions
- id
- title
- title_state
- lifecycle_state
- orchestrator_model
- visibility
- max_turns
- auto_extend
- stop_policy
- stop_reason
- created_at
- updated_at

### session_participants
- id
- session_id
- model_name
- display_name
- position

### session_messages
- id
- session_id
- role
- speaker_model
- content
- turn_index
- created_at

### session_summaries
- session_id
- headline
- bullets_json
- highlights_json
- generated_at

## Acceptance Criteria

1. 세션 생성 API는 질문 없이도 세션을 만들 수 있어야 한다.
2. 세션 생성 직후 반환 제목은 항상 `Untitled`여야 한다.
3. 첫 메시지 이후 제목 자동 생성이 가능해야 한다.
4. 유저가 제목을 수정하면 이후 자동 생성이 덮어쓰지 않아야 한다.
5. 참가 AI는 2~16개 범위를 벗어나면 요청이 거부돼야 한다.
6. participant timeout은 세션 전체 실패가 아니라 부분 fallback으로 처리돼야 한다.
7. session lifecycle state는 클라이언트가 polling만으로도 복원 가능해야 한다.

## 다음 단계

이 문서 다음으로 자연스러운 작업은 아래 둘 중 하나다.

1. 실제 DB 스키마 초안
2. 프론트엔드 상태 관리 구조 설계
