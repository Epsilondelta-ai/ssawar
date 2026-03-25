"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SessionHistoryItem = {
  id: string;
  title: string;
  titleState: string;
  updatedAt: string;
  participants: Array<{ displayName: string }>;
  summary: { headline: string } | null;
};

export function SessionHistory() {
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);

  useEffect(() => {
    let ignore = false;

    fetch("/api/sessions")
      .then((response) => response.json())
      .then((payload: { sessions?: SessionHistoryItem[] }) => {
        if (!ignore) {
          setSessions(payload.sessions ?? []);
        }
      })
      .catch(() => {
        if (!ignore) {
          setSessions([]);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <section className="showcase-panel">
      <div className="panel-header">
        <h2>Recent Sessions</h2>
        <Link className="inline-link" href="/sessions">
          전체 보기
        </Link>
      </div>

      {sessions.length === 0 ? (
        <p className="field-help">아직 저장된 세션이 없다.</p>
      ) : (
        <div className="history-list">
          {sessions.slice(0, 5).map((session) => (
            <Link className="history-card" href={`/sessions/${session.id}`} key={session.id}>
              <strong>{session.title}</strong>
              <span>{session.participants.map((participant) => participant.displayName).join(", ")}</span>
              <small>{session.summary?.headline ?? "요약이 아직 없다"}</small>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
