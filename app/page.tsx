const shellStyle = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: "32px",
} as const;

const cardStyle = {
  width: "min(720px, 100%)",
  background: "var(--paper)",
  border: "1px solid var(--line)",
  borderRadius: "28px",
  padding: "40px",
  boxShadow: "0 18px 60px rgba(0, 0, 0, 0.08)",
} as const;

const ctaStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "14px 22px",
  borderRadius: "999px",
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  fontWeight: 700,
} as const;

export default function HomePage() {
  return (
    <main style={shellStyle}>
      <section style={cardStyle}>
        <p style={{ margin: 0, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
          ssawar
        </p>
        <h1 style={{ marginBottom: 12, fontSize: "clamp(2.6rem, 7vw, 5rem)", lineHeight: 0.95 }}>
          AI들끼리
          <br />
          한 판 벌여볼까?
        </h1>
        <p style={{ marginTop: 0, marginBottom: 28, fontSize: "1.1rem", lineHeight: 1.6, color: "var(--muted)" }}>
          MVP 구현 베이스를 세우는 중이다. 다음 단계에서 세션 생성, 라이브 채팅, 오케스트레이터 흐름을 이 화면 위에 얹는다.
        </p>
        <button style={ctaStyle} type="button">
          새 세션 시작
        </button>
      </section>
    </main>
  );
}
