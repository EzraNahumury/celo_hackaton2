// Route-level loading UI. Gives mobile browsers something to paint the
// moment a navigation starts, so a slow client transition doesn't look
// like a dead page and trigger the browser's "This page couldn't load"
// recovery screen.
export default function Loading() {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center">
      <span
        aria-label="Loading"
        className="h-7 w-7 animate-spin rounded-full border-[3px] border-white/20 border-t-[color:var(--color-primary)]"
      />
    </main>
  );
}
