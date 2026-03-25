"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_ORCHESTRATOR_MODEL, DEFAULT_PARTICIPANTS, SUPPORTED_MODELS, getModelById } from "@/lib/models";

const suggestedLineups = [
  ["gpt-5.4", "claude-opus-4-5", "gemini-2.5-pro"],
  ["gpt-5.4", "claude-sonnet-4-5"],
  ["claude-opus-4-5", "gemini-2.5-pro", "gpt-5.4-pro"],
];

function lineupLabel(models: string[]) {
  return models
    .map((model) => getModelById(model)?.label ?? model)
    .join(" / ");
}

export function HomeShell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orchestratorModel, setOrchestratorModel] = useState(DEFAULT_ORCHESTRATOR_MODEL);
  const [participants, setParticipants] = useState<string[]>(DEFAULT_PARTICIPANTS);
  const [visibility, setVisibility] = useState<"private" | "link" | "public">("private");

  const orchestrators = useMemo(
    () => SUPPORTED_MODELS.filter((model) => model.kind === "both" || model.kind === "orchestrator"),
    [],
  );
  const participantCatalog = useMemo(
    () => SUPPORTED_MODELS.filter((model) => model.kind === "both" || model.kind === "participant"),
    [],
  );

  async function createSession() {
    if (participants.length < 2) {
      setError("참가 AI는 최소 2개 필요하다.");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orchestratorModel,
          participantModels: participants,
          visibility,
        }),
      });

      const payload = (await response.json()) as { session?: { id: string }; error?: { message: string } };

      if (!response.ok || !payload.session) {
        throw new Error(payload.error?.message ?? "SESSION_CREATE_FAILED");
      }

      router.push(`/sessions/${payload.session.id}`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "SESSION_CREATE_FAILED");
      setIsCreating(false);
    }
  }

  function toggleParticipant(modelId: string) {
    setParticipants((current) => {
      if (current.includes(modelId)) {
        if (current.length <= 2) {
          return current;
        }

        return current.filter((value) => value !== modelId);
      }

      if (current.length >= 16) {
        return current;
      }

      return [...current, modelId];
    });
  }

  function applyLineup(models: string[]) {
    setParticipants(models);
    setIsOpen(true);
  }

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div className="eyebrow-row">
          <span className="eyebrow">ssawar</span>
          <span className="eyebrow-subtle">untitled sessions, orchestrated chaos</span>
        </div>
        <h1 className="hero-title">
          AI들끼리
          <br />
          한 판 벌여볼까?
        </h1>
        <p className="hero-copy">
          오케스트레이터 AI와 참가 AI를 고른 뒤 빈 세션을 연다. 첫 메시지를 던지면 `Untitled` 세션이 바로 살아난다.
        </p>
        <div className="hero-actions">
          <button className="primary-button" onClick={() => setIsOpen(true)} type="button">
            새 세션 시작
          </button>
          <span className="subtle-note">질문 없이도 바로 시작 가능</span>
        </div>

        <div className="showcase-grid">
          <section className="showcase-panel">
            <h2>Popular Sessions</h2>
            <div className="chip-row">
              <span className="tag-chip">창업 조언 대결</span>
              <span className="tag-chip">밈 감별</span>
              <span className="tag-chip">누가 더 독설적인가</span>
            </div>
          </section>

          <section className="showcase-panel">
            <h2>Recommended Lineups</h2>
            <div className="lineup-list">
              {suggestedLineups.map((models) => (
                <button className="lineup-card" key={models.join("-")} onClick={() => applyLineup(models)} type="button">
                  {lineupLabel(models)}
                </button>
              ))}
            </div>
          </section>
        </div>
      </section>

      {isOpen ? (
        <div className="modal-backdrop" onClick={() => setIsOpen(false)} role="presentation">
          <section className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="modal-kicker">Create Session</p>
                <h2>Untitled</h2>
              </div>
              <button className="ghost-button" onClick={() => setIsOpen(false)} type="button">
                닫기
              </button>
            </div>

            <div className="field-stack">
              <label className="field-label" htmlFor="orchestrator">
                진행자 AI
              </label>
              <select id="orchestrator" value={orchestratorModel} onChange={(event) => setOrchestratorModel(event.target.value)}>
                {orchestrators.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
              <p className="field-help">이 AI가 세션 흐름, 개입 타이밍, 요약을 관리한다.</p>
            </div>

            <div className="field-stack">
              <span className="field-label">참가 AI</span>
              <div className="chip-row">
                {participantCatalog.map((model) => {
                  const selected = participants.includes(model.id);
                  return (
                    <button
                      className={selected ? "choice-chip choice-chip-selected" : "choice-chip"}
                      key={model.id}
                      onClick={() => toggleParticipant(model.id)}
                      type="button"
                    >
                      {model.label}
                    </button>
                  );
                })}
              </div>
              <p className="field-help">최소 2개, 최대 16개. 선택된 참가자: {participants.length}</p>
            </div>

            <div className="field-stack">
              <span className="field-label">공개 범위</span>
              <div className="segmented-row">
                {(["private", "link", "public"] as const).map((value) => (
                  <button
                    className={visibility === value ? "segmented-button segmented-button-active" : "segmented-button"}
                    key={value}
                    onClick={() => setVisibility(value)}
                    type="button"
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            {error ? <p className="error-banner">{error}</p> : null}

            <div className="modal-footer">
              <button className="ghost-button" onClick={() => setIsOpen(false)} type="button">
                Cancel
              </button>
              <button className="primary-button" disabled={isCreating} onClick={createSession} type="button">
                {isCreating ? "세션 생성 중..." : "Start"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
