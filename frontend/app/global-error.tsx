"use client";

// Last-resort boundary. Replaces the root layout when an error escapes
// the route-level error.tsx (and anything in layout.tsx providers). Must
// include its own <html>/<body> since the parent layout is skipped here.
//
// Surfaces the real error message on-screen so a phone user / simulator
// can capture it without needing DevTools — the default Next.js fallback
// ("This page couldn't load") is decorative and hides the root cause.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body
        style={{
          minHeight: "100dvh",
          margin: 0,
          background: "#0b1230",
          color: "#fff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
            Gambit — render error
          </h1>
          <p style={{ fontSize: 13, opacity: 0.75, marginTop: 8 }}>
            Something threw during render. Message below.
          </p>
          <pre
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 8,
              background: "rgba(255,255,255,0.08)",
              color: "#ffb4b4",
              fontSize: 12,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: "50vh",
              overflow: "auto",
            }}
          >
            {error?.name ? `${error.name}: ` : ""}
            {error?.message ?? "Unknown error"}
            {error?.digest ? `\n\ndigest: ${error.digest}` : ""}
            {error?.stack ? `\n\n${error.stack}` : ""}
          </pre>
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={reset}
              style={{
                borderRadius: 9999,
                background: "#1e6fd9",
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                border: "none",
                padding: "8px 20px",
              }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") window.location.href = "/";
              }}
              style={{
                borderRadius: 9999,
                background: "transparent",
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                border: "1px solid rgba(255,255,255,0.3)",
                padding: "8px 20px",
              }}
            >
              Home
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
