"use client";

import { useBalance } from "wagmi";
import { useWallet } from "@/hooks/use-connect";
import { truncateAddress, weiToLocal } from "@/lib/format";

export function WalletChip() {
  const { address, isConnected, connect, isConnecting } = useWallet();
  const { data: bal } = useBalance({
    address,
    query: { enabled: !!address },
  });

  if (!isConnected) {
    return (
      <button
        type="button"
        onClick={connect}
        disabled={isConnecting}
        className="rounded-full bg-white text-[color:var(--color-primary-dark)] px-4 py-1.5 text-xs font-bold shadow-sm active:scale-[0.98] disabled:opacity-70"
      >
        {isConnecting ? "…" : "Connect"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 backdrop-blur-sm">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
      <span className="text-[11px] font-semibold font-mono">{truncateAddress(address!)}</span>
      {bal && (
        <span className="text-[10px] text-white/75">
          {weiToLocal(bal.value)}
        </span>
      )}
    </div>
  );
}
