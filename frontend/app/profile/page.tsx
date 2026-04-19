"use client";

import { useState } from "react";
import { useBalance } from "wagmi";
import { BottomNav } from "@/components/bottom-nav";
import {
  ChevronRight,
  ClubIcon,
  PuzzleIcon,
  SparkleIcon,
  SwordsIcon,
  TrophyIcon,
} from "@/components/icons";
import { useWallet } from "@/hooks/use-connect";
import { usePlayerBadges } from "@/hooks/use-badges";
import { ACTIVE_CHAIN, CONTRACTS } from "@/lib/contracts";
import { formatCeloWei, truncateAddress, weiToLocal } from "@/lib/format";

type ContractKey = "hub" | "matchEscrow" | "puzzlePool" | "clubVault" | "badges";

type ContractMeta = {
  key: ContractKey;
  name: string;
  file: string;
  tag: string;
  desc: string;
  Icon: (p: { size?: number; className?: string }) => React.ReactElement;
  accent: {
    chip: string;
    chipText: string;
  };
};

const CONTRACT_META: ContractMeta[] = [
  {
    key: "hub",
    name: "GambitHub",
    file: "GambitHub.sol",
    tag: "Registry",
    desc: "Router fee 50/50 → treasury & PuzzlePool, access control, pausable.",
    Icon: SparkleIcon,
    accent: {
      chip: "bg-indigo-100",
      chipText: "text-indigo-600",
    },
  },
  {
    key: "matchEscrow",
    name: "MatchEscrow",
    file: "MatchEscrow.sol",
    tag: "1v1 Stake",
    desc: "createMatch → joinMatch → settleMatch. Oracle-signed result payout.",
    Icon: SwordsIcon,
    accent: {
      chip: "bg-[color:var(--color-primary-100)]",
      chipText: "text-[color:var(--color-primary-dark)]",
    },
  },
  {
    key: "puzzlePool",
    name: "PuzzlePool",
    file: "PuzzlePool.sol",
    tag: "Daily",
    desc: "Prize pool harian. Sponsor deposit + Merkle claim untuk top finisher.",
    Icon: PuzzleIcon,
    accent: {
      chip: "bg-cyan-100",
      chipText: "text-cyan-700",
    },
  },
  {
    key: "clubVault",
    name: "ClubVault",
    file: "ClubVault.sol",
    tag: "Weekly",
    desc: "Buy-in mingguan 4–8 member. Split 70/20/10 + carry-over 10%.",
    Icon: ClubIcon,
    accent: {
      chip: "bg-amber-100",
      chipText: "text-amber-700",
    },
  },
  {
    key: "badges",
    name: "GambitBadges",
    file: "GambitBadges.sol",
    tag: "ERC-5192",
    desc: "Soulbound milestone badges — FIRST_WIN, CLUB_CHAMPION, RATING_1400.",
    Icon: TrophyIcon,
    accent: {
      chip: "bg-pink-100",
      chipText: "text-pink-600",
    },
  },
];

export default function ProfilePage() {
  const { address, isConnected, connect, isConnecting, disconnect, connector } = useWallet();
  const { data: bal } = useBalance({ address, query: { enabled: !!address } });
  const { badges } = usePlayerBadges(address);
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const fairPlayHeld = Boolean(badges[4]?.owned);

  const onCopy = async (addr: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(addr);
      setTimeout(() => setCopied(null), 1400);
    } catch {}
  };

  return (
    <>
      <div className="bg-hero rounded-b-[32px] px-5 pt-[max(env(safe-area-inset-top),18px)] pb-16 text-white">
        <header className="flex items-center justify-center">
          <p className="text-sm font-bold">Akun</p>
        </header>
        <div className="mt-6 flex flex-col items-center text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 text-2xl font-extrabold">
            {address ? address.slice(2, 4).toUpperCase() : "??"}
          </span>
          <p className="mt-3 text-lg font-bold">
            {address ? truncateAddress(address, 8, 6) : "Belum terhubung"}
          </p>
          <p className="text-[11px] text-white/75">{ACTIVE_CHAIN.name}</p>
        </div>
      </div>

      <main className="flex-1 px-5 pb-6">
        <section className="card -mt-10 p-4 relative z-10">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Saldo" value={bal ? weiToLocal(bal.value) : "—"} />
            <Stat label="CELO" value={bal ? formatCeloWei(bal.value, 3) : "—"} />
            <Stat label="Badges" value={String(badges.filter((b) => b.owned).length)} />
          </div>
          {!isConnected ? (
            <button
              type="button"
              onClick={connect}
              disabled={isConnecting}
              className="mt-4 w-full rounded-2xl bg-[color:var(--color-primary)] py-3 text-sm font-bold text-white shadow-[var(--shadow-glow-primary)]"
            >
              {isConnecting ? "Menghubungkan…" : "Connect MiniPay"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDisconnect(true)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-danger)]/40 bg-[color:var(--color-danger-soft)] py-3 text-sm font-bold text-[color:var(--color-danger)] transition active:scale-[0.99] hover:bg-[color:var(--color-danger)] hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
              Disconnect
            </button>
          )}
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[color:var(--color-ink-0)]">
              Badges (ERC-5192)
            </h2>
            <span className="text-[10px] font-semibold text-[color:var(--color-ink-3)]">
              Soulbound
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {badges.map((b) => (
              <div
                key={b.type}
                className={`rounded-2xl border p-3 ${
                  b.owned
                    ? b.type === 5
                      ? "border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger-soft)]"
                      : "border-[color:var(--color-primary)]/30 bg-[color:var(--color-primary-50)]"
                    : "border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)] opacity-60"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{b.emoji}</span>
                  <p className="text-sm font-bold text-[color:var(--color-ink-0)]">{b.label}</p>
                </div>
                <p className="mt-1 text-[10px] text-[color:var(--color-ink-2)]">{b.desc}</p>
                <p
                  className={`mt-1 text-[10px] font-bold uppercase tracking-wider ${
                    b.owned
                      ? b.type === 5
                        ? "text-[color:var(--color-danger)]"
                        : "text-[color:var(--color-primary)]"
                      : "text-[color:var(--color-ink-3)]"
                  }`}
                >
                  {b.owned ? "Dimiliki" : "Belum"}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[color:var(--color-ink-0)]">Kontrak</h2>
              <p className="text-[11px] text-[color:var(--color-ink-2)]">
                Semua stake & payout terjadi di sini.
              </p>
            </div>
            <span className="rounded-full bg-[color:var(--color-primary-50)] px-3 py-1 text-[10px] font-bold text-[color:var(--color-primary-dark)]">
              {CONTRACT_META.filter((c) => isConfigured(CONTRACTS[c.key])).length}/
              {CONTRACT_META.length} live
            </span>
          </div>

          <ul className="mt-3 flex flex-col gap-2">
            {CONTRACT_META.map((c) => (
              <ContractCard
                key={c.key}
                meta={c}
                addr={CONTRACTS[c.key]}
                onCopy={onCopy}
                copied={copied === CONTRACTS[c.key]}
              />
            ))}
          </ul>
        </section>

        <section className="mt-6">
          <h2 className="text-base font-bold text-[color:var(--color-ink-0)]">Tentang</h2>
          <ul className="mt-3 flex flex-col gap-2">
            <InfoRow
              icon={<GlobeIcon />}
              tint="bg-[color:var(--color-primary-100)] text-[color:var(--color-primary-dark)]"
              label="Network"
            >
              <Chip
                tone="primary"
                dot
                text={`${ACTIVE_CHAIN.name} · ${ACTIVE_CHAIN.id}`}
              />
            </InfoRow>

            <InfoRow
              icon={<ShieldIcon />}
              tint={
                fairPlayHeld
                  ? "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]"
                  : "bg-[color:var(--color-success-soft)] text-[color:var(--color-success)]"
              }
              label="Fair Play"
            >
              <Chip
                tone={fairPlayHeld ? "danger" : "success"}
                dot
                text={fairPlayHeld ? "Ditahan" : "Aktif"}
              />
            </InfoRow>

            <InfoRow
              icon={<ChatIcon />}
              tint="bg-cyan-100 text-cyan-700"
              label="Support"
              trailingAction
              href="https://t.me/gambitchess"
            >
              <span className="text-xs font-bold text-[color:var(--color-primary)]">
                t.me/gambitchess
              </span>
            </InfoRow>

            <InfoRow
              icon={<InfoIcon />}
              tint="bg-[color:var(--color-surface-soft)] text-[color:var(--color-ink-2)]"
              label="Versi"
            >
              <span className="font-mono text-xs font-bold text-[color:var(--color-ink-1)]">
                v0.1.0
              </span>
            </InfoRow>
          </ul>
        </section>
      </main>
      <BottomNav />

      {confirmDisconnect && address && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[color:var(--color-ink-0)]/55 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setConfirmDisconnect(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative w-full max-w-sm rounded-3xl border border-[color:var(--color-border)] bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setConfirmDisconnect(false)}
              aria-label="Tutup"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--color-surface-soft)] text-[color:var(--color-ink-2)] transition hover:bg-[color:var(--color-border)]"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>

            <div className="flex flex-col items-center">
              <span
                className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full shadow-[var(--shadow-glow-primary)]"
                style={{
                  background: connector?.icon
                    ? "white"
                    : "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)",
                }}
              >
                {connector?.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={connector.icon}
                    alt={connector.name ?? "Wallet"}
                    className="h-16 w-16 object-contain"
                  />
                ) : (
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-white">
                    <path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2" />
                    <path d="M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
                    <path d="M21 10h-5a2 2 0 0 0 0 4h5a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1z" />
                    <circle cx="16.5" cy="12" r="1" fill="currentColor" stroke="none" />
                  </svg>
                )}
              </span>

              <p className="mt-4 font-mono text-sm font-bold text-[color:var(--color-ink-0)]">
                {truncateAddress(address, 6, 4)}
              </p>

              <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-primary)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-primary)]" />
                {bal ? formatCeloWei(bal.value, 3) : "0 CELO"} · Gas
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onCopy(address)}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)] px-3 py-4 text-[color:var(--color-ink-0)] transition active:scale-[0.98] hover:border-[color:var(--color-primary-200)] hover:bg-[color:var(--color-primary-50)]"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-[color:var(--color-primary)]">
                  <rect x="9" y="9" width="12" height="12" rx="2" />
                  <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                </svg>
                <span className="text-xs font-bold">
                  {copied === address ? "Tersalin!" : "Copy Address"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  disconnect();
                  setConfirmDisconnect(false);
                }}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger-soft)] px-3 py-4 text-[color:var(--color-danger)] transition active:scale-[0.98] hover:bg-[color:var(--color-danger)] hover:text-white"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <path d="M16 12h4" />
                  <path d="M8 12h.01" />
                </svg>
                <span className="text-xs font-bold">Disconnect</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function isConfigured(addr: string) {
  return !!addr && addr.length === 42 && addr !== "0x";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[color:var(--color-surface-soft)] px-3 py-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-2)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-[color:var(--color-ink-0)]">{value}</p>
    </div>
  );
}

function ContractCard({
  meta,
  addr,
  onCopy,
  copied,
}: {
  meta: ContractMeta;
  addr: `0x${string}`;
  onCopy: (addr: string) => void;
  copied: boolean;
}) {
  const live = isConfigured(addr);
  const explorer = ACTIVE_CHAIN.blockExplorers?.default.url;

  return (
    <li className="card overflow-hidden p-0">
      <div className="flex items-start gap-3 p-4">
        <span
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${meta.accent.chip} ${meta.accent.chipText}`}
        >
          <meta.Icon size={20} />
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-[color:var(--color-ink-0)]">{meta.name}</p>
            <span
              className={`rounded-full ${meta.accent.chip} ${meta.accent.chipText} px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider`}
            >
              {meta.tag}
            </span>
          </div>
          <p className="mt-0.5 truncate font-mono text-[10px] text-[color:var(--color-ink-3)]">
            {meta.file}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-[color:var(--color-ink-2)]">
            {meta.desc}
          </p>
        </div>
      </div>

      {live ? (
        <div className="flex items-center gap-0 border-t border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)]">
          <button
            type="button"
            onClick={() => onCopy(addr)}
            className="flex flex-1 items-center gap-2 px-4 py-2.5 text-left"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-success)]" />
            <code className="font-mono text-[11px] font-semibold text-[color:var(--color-ink-1)]">
              {truncateAddress(addr, 10, 8)}
            </code>
            <span className="ml-auto text-[10px] font-bold text-[color:var(--color-ink-3)]">
              {copied ? "Copied ✓" : "Copy"}
            </span>
          </button>
          {explorer && (
            <a
              href={`${explorer}/address/${addr}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 border-l border-[color:var(--color-border)] px-4 py-2.5 text-[11px] font-bold text-[color:var(--color-primary)]"
            >
              Celoscan
              <ExternalIcon />
            </a>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between border-t border-dashed border-[color:var(--color-amber)]/40 bg-[color:var(--color-amber-soft)] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-amber)]" />
            <span className="text-[11px] font-bold text-[color:var(--color-amber)]">
              Belum di-deploy
            </span>
          </div>
          <span className="font-mono text-[10px] text-[color:var(--color-ink-3)]">
            NEXT_PUBLIC_{meta.key.replace(/([A-Z])/g, "_$1").toUpperCase()}
          </span>
        </div>
      )}
    </li>
  );
}

function InfoRow({
  icon,
  tint,
  label,
  children,
  href,
  trailingAction,
}: {
  icon: React.ReactNode;
  tint: string;
  label: string;
  children: React.ReactNode;
  href?: string;
  trailingAction?: boolean;
}) {
  const inner = (
    <div className="card flex items-center gap-3 px-3 py-3">
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tint}`}>
        {icon}
      </span>
      <span className="flex-1 text-sm font-semibold text-[color:var(--color-ink-0)]">
        {label}
      </span>
      {children}
      {trailingAction && <ChevronRight size={14} className="text-[color:var(--color-ink-3)]" />}
    </div>
  );
  if (href) {
    return (
      <li>
        <a href={href} target="_blank" rel="noopener noreferrer">
          {inner}
        </a>
      </li>
    );
  }
  return <li>{inner}</li>;
}

function Chip({
  tone,
  text,
  dot,
}: {
  tone: "primary" | "success" | "danger" | "neutral";
  text: string;
  dot?: boolean;
}) {
  const styles = {
    primary: "bg-[color:var(--color-primary-50)] text-[color:var(--color-primary-dark)]",
    success: "bg-[color:var(--color-success-soft)] text-[color:var(--color-success)]",
    danger: "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]",
    neutral: "bg-[color:var(--color-surface-soft)] text-[color:var(--color-ink-2)]",
  }[tone];
  const dotColor = {
    primary: "bg-[color:var(--color-primary)]",
    success: "bg-[color:var(--color-success)]",
    danger: "bg-[color:var(--color-danger)]",
    neutral: "bg-[color:var(--color-ink-3)]",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${styles}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />}
      {text}
    </span>
  );
}

function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01M11 12h1v5h1" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}
