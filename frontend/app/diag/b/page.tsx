import Link from "next/link";

export default function DiagBPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
        background: "#081a3b",
        color: "#fff",
      }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>/diag/b</h1>
      <p style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
        If you see this page, plain server-component navigation worked.
      </p>
      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <Link
          href="/diag"
          style={{
            display: "inline-block",
            padding: "10px 14px",
            background: "rgba(255,255,255,0.08)",
            color: "#fff",
            borderRadius: 8,
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          ← back to /diag
        </Link>
      </div>
    </main>
  );
}
