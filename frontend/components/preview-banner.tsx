"use client";

import { ACTIVE_CHAIN, CONTRACTS_CONFIGURED } from "@/lib/contracts";

export function PreviewBanner() {
  if (CONTRACTS_CONFIGURED) return null;
  return (
    <div className="relative z-30 border-b border-[color:var(--color-amber)]/30 bg-[color:var(--color-amber-soft)] px-4 py-1.5 text-center text-[11px] font-medium text-[color:var(--color-ink-0)]">
      <span className="font-bold text-[color:var(--color-amber)]">Preview · </span>
      Contracts belum di-deploy di {ACTIVE_CHAIN.name}. Isi alamat di{" "}
      <code className="text-[10px]">.env.local</code>.
    </div>
  );
}
