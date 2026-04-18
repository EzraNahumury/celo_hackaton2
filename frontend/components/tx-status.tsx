"use client";

import { useWaitForTransactionReceipt } from "wagmi";
import { ACTIVE_CHAIN } from "@/lib/contracts";

type Status = "idle" | "pending" | "success" | "error";

export function useTxStatus(hash: `0x${string}` | undefined) {
  const { isLoading, isSuccess, isError } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  });
  const status: Status = !hash
    ? "idle"
    : isLoading
    ? "pending"
    : isSuccess
    ? "success"
    : isError
    ? "error"
    : "pending";
  return { status };
}

export function TxExplorerLink({ hash }: { hash: `0x${string}` }) {
  const base = ACTIVE_CHAIN.blockExplorers?.default.url;
  if (!base) return null;
  return (
    <a
      href={`${base}/tx/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[11px] font-semibold text-[color:var(--color-primary)] underline decoration-dotted"
    >
      Lihat di Celoscan ↗
    </a>
  );
}
