"use client";

import { useEffect, useRef } from "react";
import { useAccount, useConnect, useDisconnect, type Connector } from "wagmi";

type Props = {
  open: boolean;
  onClose: () => void;
  onConnected?: () => void;
};

function prettyName(c: Connector) {
  const n = c.name || c.id;
  if (n.toLowerCase() === "injected") return "Browser Wallet";
  return n;
}

function walletIcon(c: Connector): string {
  if (typeof c.icon === "string" && c.icon.length > 0) return c.icon;
  const n = (c.name || c.id || "").toLowerCase();
  if (n.includes("metamask")) return "🦊";
  if (n.includes("coinbase")) return "🔵";
  if (n.includes("okx")) return "⬛";
  if (n.includes("rabby")) return "🐇";
  if (n.includes("talisman")) return "👁";
  if (n.includes("phantom")) return "👻";
  if (n.includes("trust")) return "🛡️";
  if (n.includes("minipay")) return "💳";
  return "🪙";
}

function isImageIcon(icon: string): boolean {
  return icon.startsWith("data:") || icon.startsWith("http") || icon.startsWith("/");
}

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

export function WalletPicker({ open, onClose, onConnected }: Props) {
  const { connectors, connect, isPending: isConnecting, error } = useConnect();
  const { isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const userInitiated = useRef(false);

  const connectWith = async (c: Connector) => {
    userInitiated.current = true;
    try {
      const provider = (await c.getProvider()) as EthereumProvider | undefined;
      if (provider?.request) {
        if (isConnected) {
          try {
            disconnect();
          } catch {}
        }
        await provider.request({
          method: "wallet_requestPermissions",
          params: [{ eth_accounts: {} }],
        });
      }
    } catch (err) {
      const e = err as { code?: number; message?: string };
      if (e?.code === 4001 || /reject|denied/i.test(e?.message ?? "")) {
        userInitiated.current = false;
        return;
      }
    }
    connect({ connector: c });
  };

  useEffect(() => {
    if (!open) userInitiated.current = false;
  }, [open]);

  useEffect(() => {
    if (open && isConnected && userInitiated.current) {
      userInitiated.current = false;
      onClose();
      onConnected?.();
    }
  }, [open, isConnected, onClose, onConnected]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const list = connectors.length > 0 ? connectors : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Connect a wallet"
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0e1230] p-5 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">Connect a wallet</h2>
            <p className="mt-0.5 text-xs text-white/60">Pilih cara kamu untuk sign in</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/15"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <ul className="mt-4 flex flex-col gap-2">
          {list.length === 0 && (
            <li className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              Tidak ada wallet yang terdeteksi di browser. Install ekstensi seperti MetaMask, Rabby, atau Coinbase Wallet, lalu muat ulang halaman ini.
            </li>
          )}
          {list.map((c, i) => {
            const icon = walletIcon(c);
            const isImg = isImageIcon(icon);
            return (
              <li key={`${c.id}-${i}`}>
                <button
                  type="button"
                  onClick={() => connectWith(c)}
                  disabled={isConnecting}
                  className="group flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-left transition hover:border-white/20 hover:bg-white/[0.07] disabled:opacity-60"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 text-2xl">
                    {isImg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={icon} alt="" className="h-10 w-10 object-cover" />
                    ) : (
                      <span>{icon}</span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold">{prettyName(c)}</span>
                      {i === 0 && (
                        <span className="rounded-md bg-[#7c5cff]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#c4b5fd]">
                          Recommended
                        </span>
                      )}
                    </span>
                    <span className="block text-[11px] text-white/55">Browser extension</span>
                  </span>
                  <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-300">
                    Detected
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {error && (
          <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error.message}
          </p>
        )}

        <p className="mt-4 border-t border-white/10 pt-3 text-[11px] text-white/55">
          Baru di wallet Ethereum?{" "}
          <a
            href="https://ethereum.org/en/wallets/find-wallet/"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[#8b9dff] hover:underline"
          >
            Pelajari
          </a>
        </p>
      </div>
    </div>
  );
}
