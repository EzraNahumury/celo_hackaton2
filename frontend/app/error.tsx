"use client";

// Route-level error boundary. Without this, a render-time crash on any
// page propagates to Next.js's built-in `DefaultGlobalError`, which only
// shows "This page couldn't load" — unhelpful on mobile where DevTools
// isn't trivially available. Print the actual error so it can be read
// straight off the screen / screenshot.
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      className="flex min-h-dvh flex-1 flex-col items-stretch px-5 py-6"
      style={{ color: "var(--color-ink-0)" }}
    >
      <h1 className="text-base font-bold">Gambit — page error</h1>
      <p className="mt-1 text-xs text-[color:var(--color-ink-2)]">
        This route threw during render. Details below.
      </p>
      <pre
        className="mt-3 max-h-[55vh] overflow-auto rounded-lg border border-[color:var(--color-border)] p-3 text-[11px] leading-relaxed"
        style={{
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          background: "var(--color-surface-soft)",
          color: "#b42318",
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        }}
      >
        {error?.name ? `${error.name}: ` : ""}
        {error?.message ?? "Unknown error"}
        {error?.digest ? `\n\ndigest: ${error.digest}` : ""}
        {error?.stack ? `\n\n${error.stack}` : ""}
      </pre>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-[color:var(--color-primary)] px-5 py-2 text-xs font-bold text-white"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") window.location.href = "/home";
          }}
          className="rounded-full border border-[color:var(--color-border)] px-5 py-2 text-xs font-bold text-[color:var(--color-ink-1)]"
        >
          Back to Home
        </button>
      </div>
    </main>
  );
}
