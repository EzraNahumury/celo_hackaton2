import Link from "next/link";

export default function DiagPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
        background: "#0b1230",
        color: "#fff",
      }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>/diag</h1>
      <p style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
        Navigate using the two methods below and note which ones break.
      </p>

      <section style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700 }}>
          A) Next.js client-side Link (uses RSC fetch)
        </h2>
        <div style={group}>
          <Link href="/diag/b" style={btn}>/diag/b via Link</Link>
          <Link href="/home" style={btn}>/home via Link</Link>
        </div>
      </section>

      <section style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700 }}>
          B) Plain anchor (full page reload, no RSC)
        </h2>
        <div style={group}>
          <a href="/diag/b" style={btn}>/diag/b via anchor</a>
          <a href="/home" style={btn}>/home via anchor</a>
        </div>
      </section>

      <p style={{ marginTop: 24, fontSize: 12, opacity: 0.6 }}>
        If (A) fails but (B) works → client-side RSC navigation is broken in
        your simulator. If both fail the same way → unrelated to navigation
        style. If both work from here → the issue is provider-specific.
      </p>
    </main>
  );
}

const group: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 8,
};
const btn: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 14px",
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  borderRadius: 8,
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 600,
};
