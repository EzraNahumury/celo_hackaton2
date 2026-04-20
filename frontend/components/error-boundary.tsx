"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

// Root error boundary — keeps mobile Safari from nuking the whole page to
// its native "This page couldn't load" screen when a render error occurs.
// We swallow `dispatchEvent` noise coming from wallet extensions and show a
// minimal recoverable UI for anything else.
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    if (error?.message && /dispatchEvent/i.test(error.message)) {
      // Known wallet-extension noise — recover silently on next tick.
      setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__gambitRecover?.();
      }, 0);
      return { error: null };
    }
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("[gambit] render error:", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-lg font-bold text-[color:var(--color-ink-0)]">
          Something went wrong
        </h1>
        <p className="text-sm text-[color:var(--color-ink-2)]">
          Try reloading the page. If the problem persists, disconnect your
          wallet and reconnect.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-[color:var(--color-primary)] px-5 py-2 text-xs font-bold text-white"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded-full border border-[color:var(--color-border)] px-5 py-2 text-xs font-bold text-[color:var(--color-ink-1)]"
          >
            Dismiss
          </button>
        </div>
      </main>
    );
  }
}
