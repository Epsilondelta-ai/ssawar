import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">ssawar</p>
        <h1 className="hero-title">세션을 찾지 못했다.</h1>
        <p className="hero-copy">링크가 잘못됐거나 세션이 아직 생성되지 않았다.</p>
        <Link className="primary-button" href="/">
          홈으로 돌아가기
        </Link>
      </section>
    </main>
  );
}
