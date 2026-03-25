import Link from "next/link";
import { getViewerIdFromServer } from "@/lib/auth";
import { listSessionsForUser } from "@/lib/session-service";

export default async function SessionsPage() {
  const viewerId = await getViewerIdFromServer();
  const sessions = await listSessionsForUser(viewerId);

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div className="panel-header">
          <div>
            <p className="eyebrow">history</p>
            <h1 className="hero-title" style={{ fontSize: "clamp(2rem, 5vw, 3.8rem)" }}>
              최근 세션
            </h1>
          </div>
          <Link className="ghost-button" href="/">
            홈으로
          </Link>
        </div>

        {sessions.length === 0 ? (
          <p className="hero-copy">저장된 세션이 아직 없다. 홈에서 새 세션을 먼저 시작하면 여기에 쌓인다.</p>
        ) : (
          <div className="history-list history-list-full">
            {sessions.map((session) => (
              <Link className="history-card" href={`/sessions/${session.id}`} key={session.id}>
                <strong>{session.title}</strong>
                <span>{session.participants.map((participant) => participant.displayName).join(", ")}</span>
                <small>{session.summary?.headline ?? "요약이 아직 없다"}</small>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
