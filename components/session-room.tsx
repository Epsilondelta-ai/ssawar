"use client";

import { useMemo, useState } from "react";

type Session = {
  id: string;
  title: string;
  titleState: string;
  lifecycleState: string;
  orchestratorModel: string;
  participants: Array<{
    id: string;
    modelName: string;
    displayName: string;
  }>;
};

type Message = {
  id: string;
  role: "user" | "orchestrator" | "participant" | "system";
  speakerModel: string | null;
  speakerLabel: string | null;
  content: string;
  turnIndex: number;
};

type Summary = {
  headline: string;
  bullets: string[];
  highlights: Array<{
    messageId: string;
    speakerModel: string | null;
    content: string;
  }>;
  stopReason?: string | null;
} | null;

type SessionRoomProps = {
  initialSession: Session;
  initialMessages: Message[];
  initialSummary: Summary;
};

export function SessionRoom({ initialSession, initialMessages, initialSummary }: SessionRoomProps) {
  const [session, setSession] = useState(initialSession);
  const [messages, setMessages] = useState(initialMessages);
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [draft, setDraft] = useState("");
  const [titleDraft, setTitleDraft] = useState(initialSession.title);
  const [isSending, setIsSending] = useState(false);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const participantLabels = useMemo(
    () => session.participants.map((participant) => participant.displayName).join(", "),
    [session.participants],
  );

  async function sendMessage() {
    const content = draft.trim();
    if (!content) {
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch(`/api/sessions/${session.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      const payload = (await response.json()) as {
        session?: Session;
        messages?: Message[];
        error?: { message: string };
      };

      if (!response.ok || !payload.session || !payload.messages) {
        throw new Error(payload.error?.message ?? "MESSAGE_SEND_FAILED");
      }

      const nextMessages = payload.messages;
      setSession(payload.session);
      setMessages((current) => [...current, ...nextMessages]);
      setTitleDraft(payload.session.title);
      setDraft("");
      setSummary(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "MESSAGE_SEND_FAILED");
    } finally {
      setIsSending(false);
    }
  }

  async function saveTitle() {
    const title = titleDraft.trim();
    if (!title || title === session.title) {
      setTitleDraft(session.title);
      return;
    }

    setIsSavingTitle(true);
    setError(null);

    try {
      const response = await fetch(`/api/sessions/${session.id}/title`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });

      const payload = (await response.json()) as { session?: Session; error?: { message: string } };
      if (!response.ok || !payload.session) {
        throw new Error(payload.error?.message ?? "TITLE_SAVE_FAILED");
      }

      setSession((current) => ({ ...current, title: payload.session!.title, titleState: payload.session!.titleState }));
      setTitleDraft(payload.session.title);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "TITLE_SAVE_FAILED");
      setTitleDraft(session.title);
    } finally {
      setIsSavingTitle(false);
    }
  }

  async function endSession() {
    setIsEnding(true);
    setError(null);

    try {
      const response = await fetch(`/api/sessions/${session.id}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "user_requested" }),
      });

      const payload = (await response.json()) as { session?: Session; error?: { message: string } };
      if (!response.ok || !payload.session) {
        throw new Error(payload.error?.message ?? "SESSION_END_FAILED");
      }

      setSession((current) => ({ ...current, lifecycleState: payload.session!.lifecycleState }));

      const summaryResponse = await fetch(`/api/sessions/${session.id}/summary`);
      const summaryPayload = (await summaryResponse.json()) as { summary?: Summary };
      if (summaryResponse.ok && summaryPayload.summary) {
        setSummary(summaryPayload.summary);
      }

      setSession((current) => ({ ...current, lifecycleState: "finished" }));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "SESSION_END_FAILED");
    } finally {
      setIsEnding(false);
    }
  }

  return (
    <main className="session-layout">
      <aside className="session-sidebar">
        <div className="sidebar-card">
          <p className="eyebrow">orchestrator</p>
          <h2>{session.orchestratorModel}</h2>
          <p className="sidebar-copy">이 AI가 흐름, 개입 시점, 정리 타이밍을 관리한다.</p>
        </div>

        <div className="sidebar-card">
          <p className="eyebrow">participants</p>
          <p className="sidebar-copy">{participantLabels}</p>
        </div>

        <div className="sidebar-card">
          <p className="eyebrow">status</p>
          <p className="sidebar-copy">{session.lifecycleState}</p>
        </div>
      </aside>

      <section className="session-main">
        <header className="session-header">
          <div>
            <input
              aria-label="세션 제목"
              className="session-title-input"
              disabled={isSavingTitle}
              onBlur={saveTitle}
              onChange={(event) => setTitleDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void saveTitle();
                }
              }}
              value={titleDraft}
            />
            <p className="session-subtitle">title state: {session.titleState}</p>
          </div>
          <div className="session-actions">
            <button className="ghost-button" onClick={endSession} disabled={isEnding || session.lifecycleState === "finished"} type="button">
              {isEnding ? "정리 중..." : "세션 종료"}
            </button>
          </div>
        </header>

        <section className="messages-panel">
          {messages.length === 0 ? (
            <div className="empty-state">
              <h3>Untitled</h3>
              <p>아직 대화가 시작되지 않았다. 첫 메시지를 보내면 오케스트레이터가 판을 짠다.</p>
              <div className="chip-row">
                {["누가 더 똑똑한가", "창업 조언해봐", "자유 대화 시작"].map((starter) => (
                  <button className="choice-chip" key={starter} onClick={() => setDraft(starter)} type="button">
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list">
              {messages.map((message) => (
                <article className={`message-card message-card-${message.role}`} key={message.id}>
                  <div className="message-meta">
                    <span>{message.speakerLabel ?? message.role}</span>
                    <span>turn {message.turnIndex}</span>
                  </div>
                  <p>{message.content}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        {summary ? (
          <section className="summary-panel">
            <p className="eyebrow">summary</p>
            <h3>{summary.headline}</h3>
            <ul>
              {summary.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {error ? <p className="error-banner">{error}</p> : null}

        <footer className="composer-row">
          <textarea
            className="composer"
            onChange={(event) => setDraft(event.target.value)}
            placeholder="메시지를 입력하세요..."
            rows={3}
            value={draft}
          />
          <button className="primary-button" disabled={isSending || session.lifecycleState === "finished"} onClick={sendMessage} type="button">
            {isSending ? "전송 중..." : "보내기"}
          </button>
        </footer>
      </section>
    </main>
  );
}
