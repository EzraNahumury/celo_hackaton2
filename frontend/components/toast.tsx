"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { humanizeError, type FriendlyError } from "@/lib/errors";

type Toast = FriendlyError & {
  id: number;
  duration: number;
};

type ToastCtx = {
  show: (t: FriendlyError, duration?: number) => void;
  showError: (err: unknown, duration?: number) => void;
  dismiss: (id: number) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToast must be used inside <ToastProvider>");
  return c;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (t: FriendlyError, duration = 5000) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { ...t, id, duration }]);
    },
    [],
  );

  const showError = useCallback(
    (err: unknown, duration = 6000) => {
      show(humanizeError(err), duration);
    },
    [show],
  );

  return (
    <Ctx.Provider value={{ show, showError, dismiss }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </Ctx.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[max(env(safe-area-inset-top),16px)]"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setLeaving(true);
      setTimeout(onDismiss, 200);
    }, toast.duration);
    return () => {
      cancelAnimationFrame(t1);
      clearTimeout(timer);
    };
  }, [toast.duration, onDismiss]);

  const tone = TONE_STYLES[toast.tone];

  const close = () => {
    setLeaving(true);
    setTimeout(onDismiss, 180);
  };

  return (
    <div
      role="alert"
      className={`pointer-events-auto w-full max-w-[430px] overflow-hidden rounded-2xl border shadow-[var(--shadow-raised)] backdrop-blur-md transition-all duration-200 ${
        tone.wrapper
      } ${
        visible && !leaving
          ? "translate-y-0 opacity-100"
          : "-translate-y-4 opacity-0"
      }`}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span
          className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${tone.iconBg}`}
        >
          <ToneIcon tone={toast.tone} />
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold leading-tight ${tone.title}`}>{toast.title}</p>
          <p className="mt-0.5 text-[12px] leading-snug text-[color:var(--color-ink-1)]">
            {toast.message}
          </p>
          {toast.hint && (
            <p className="mt-1 text-[11px] italic text-[color:var(--color-ink-2)]">
              {toast.hint}
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={close}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[color:var(--color-ink-2)] transition hover:bg-black/5"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div
        className={`h-0.5 ${tone.bar} animate-toast-bar`}
        style={{ animationDuration: `${toast.duration}ms` }}
      />
    </div>
  );
}

const TONE_STYLES = {
  warning: {
    wrapper:
      "border-[color:var(--color-amber)]/40 bg-[color:var(--color-amber-soft)]/95",
    iconBg: "bg-[color:var(--color-amber)]/20 text-[color:var(--color-amber)]",
    title: "text-[color:var(--color-amber)]",
    bar: "bg-[color:var(--color-amber)]",
  },
  danger: {
    wrapper:
      "border-[color:var(--color-danger)]/40 bg-[color:var(--color-danger-soft)]/95",
    iconBg: "bg-[color:var(--color-danger)]/20 text-[color:var(--color-danger)]",
    title: "text-[color:var(--color-danger)]",
    bar: "bg-[color:var(--color-danger)]",
  },
  info: {
    wrapper:
      "border-[color:var(--color-primary)]/30 bg-[color:var(--color-primary-50)]/95",
    iconBg: "bg-[color:var(--color-primary)]/15 text-[color:var(--color-primary)]",
    title: "text-[color:var(--color-primary-dark)]",
    bar: "bg-[color:var(--color-primary)]",
  },
} as const;

function ToneIcon({ tone }: { tone: FriendlyError["tone"] }) {
  if (tone === "info") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8h.01M11 12h1v5h1" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
  );
}
