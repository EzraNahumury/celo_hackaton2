import { Suspense } from "react";
import { GameScreen } from "./game-screen";

export default function GamePage() {
  return (
    <Suspense fallback={<GameFallback />}>
      <GameScreen />
    </Suspense>
  );
}

function GameFallback() {
  return (
    <main className="flex-1 px-4 pt-[max(env(safe-area-inset-top),14px)] pb-6">
      <div className="mt-8 flex flex-col items-center justify-center gap-3 text-[color:var(--color-ink-2)]">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        <p className="text-sm">Preparing match…</p>
      </div>
    </main>
  );
}
