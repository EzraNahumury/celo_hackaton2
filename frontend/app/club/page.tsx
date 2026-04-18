"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ClubIcon, TrophyIcon } from "@/components/icons";
import { TxExplorerLink, useTxStatus } from "@/components/tx-status";
import { useWallet } from "@/hooks/use-connect";
import { useCreateClub, useJoinClub } from "@/hooks/use-club-vault";
import { CLUB_FEE_BPS, CLUB_FIRST_BPS, CLUB_ROLL_BPS, CLUB_SECOND_BPS } from "@/lib/contracts";
import { formatCelo, formatLocal, truncateAddress } from "@/lib/format";

const BUY_IN_OPTIONS = [0.5, 1, 2] as const;
const MAX_MEMBER_OPTIONS = [4, 6, 8] as const;

type Tab = "create" | "join";

export default function ClubPage() {
  const { address, isConnected, connect, isConnecting } = useWallet();
  const [tab, setTab] = useState<Tab>("create");
  const [buyIn, setBuyIn] = useState<number>(1);
  const [maxMembers, setMaxMembers] = useState<number>(6);
  const [joinId, setJoinId] = useState<string>("");
  const [joinBuyIn, setJoinBuyIn] = useState<string>("1");
  const [err, setErr] = useState<string | null>(null);

  const { createClub, isPending: creating, hash: createHash } = useCreateClub();
  const { joinClub, isPending: joining, hash: joinHash } = useJoinClub();
  const { status: createStatus } = useTxStatus(createHash);
  const { status: joinStatus } = useTxStatus(joinHash);

  const onCreate = async () => {
    setErr(null);
    try {
      if (!isConnected) return connect();
      await createClub({ maxMembers, buyInCelo: buyIn });
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const onJoin = async () => {
    setErr(null);
    try {
      if (!isConnected) return connect();
      const id = BigInt(joinId);
      await joinClub({ clubId: id, buyInCelo: parseFloat(joinBuyIn) });
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <main className="flex-1">
      <div className="bg-hero rounded-b-[32px] px-5 pt-[max(env(safe-area-inset-top),18px)] pb-10 text-white">
        <header className="flex items-center justify-between">
          <Link
            href="/home"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15"
            aria-label="Kembali"
          >
            <ChevronLeft size={18} />
          </Link>
          <p className="text-sm font-bold">Chess Club</p>
          <span className="h-9 w-9" />
        </header>

        <div className="mt-6 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
            <ClubIcon size={26} />
          </div>
          <h1 className="mt-3 text-2xl font-extrabold">ClubVault.sol</h1>
          <p className="text-xs text-white/80">
            4–8 anggota · split {CLUB_FIRST_BPS / 100}/{CLUB_SECOND_BPS / 100}/{CLUB_ROLL_BPS / 100}
            {" "}· fee {CLUB_FEE_BPS / 100}%
          </p>
        </div>
      </div>

      <div className="px-5 pb-8">
        <div className="card -mt-6 relative z-10 flex p-1">
          <TabBtn active={tab === "create"} onClick={() => setTab("create")}>
            Bikin Klub
          </TabBtn>
          <TabBtn active={tab === "join"} onClick={() => setTab("join")}>
            Gabung
          </TabBtn>
        </div>

        {tab === "create" ? (
          <section className="card mt-4 p-5">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--color-ink-2)]">
              Buy-in per minggu
            </h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {BUY_IN_OPTIONS.map((b) => {
                const active = b === buyIn;
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBuyIn(b)}
                    className={`rounded-2xl border-2 px-3 py-4 text-left ${
                      active
                        ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-50)]"
                        : "border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)]"
                    }`}
                  >
                    <p className="text-lg font-bold text-[color:var(--color-ink-0)]">
                      {b.toFixed(2)} CELO
                    </p>
                    <p className="text-[11px] text-[color:var(--color-ink-2)]">
                      {formatLocal(b, "IDR")}
                    </p>
                  </button>
                );
              })}
            </div>

            <h2 className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--color-ink-2)]">
              Kapasitas member (4–8)
            </h2>
            <div className="mt-3 flex gap-2">
              {MAX_MEMBER_OPTIONS.map((m) => {
                const active = m === maxMembers;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMaxMembers(m)}
                    className={`flex-1 rounded-full border px-4 py-2 text-sm font-bold ${
                      active
                        ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-white"
                        : "border-[color:var(--color-border)] bg-white text-[color:var(--color-ink-1)]"
                    }`}
                  >
                    {m} member
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl bg-[color:var(--color-surface-soft)] p-3 text-[11px] text-[color:var(--color-ink-2)]">
              <p>
                Pot penuh: {formatCelo(buyIn * maxMembers)} · juara dapat{" "}
                <b className="text-[color:var(--color-success)]">
                  {formatCelo(buyIn * maxMembers * (CLUB_FIRST_BPS / 10_000) * (1 - CLUB_FEE_BPS / 10_000))}
                </b>
                . Carry-over 10% ke minggu depan.
              </p>
            </div>

            <button
              type="button"
              onClick={onCreate}
              disabled={creating || isConnecting || createStatus === "pending"}
              className="mt-5 w-full rounded-2xl bg-[color:var(--color-primary)] py-4 text-base font-bold text-white shadow-[var(--shadow-glow-primary)] disabled:opacity-70"
            >
              {creating || createStatus === "pending"
                ? "Submitting…"
                : !isConnected
                ? "Connect MiniPay"
                : `Bikin Klub · ${formatLocal(buyIn, "IDR")}`}
            </button>
            {createHash && (
              <p className="mt-3 text-center">
                <TxExplorerLink hash={createHash} />
              </p>
            )}
          </section>
        ) : (
          <section className="card mt-4 p-5">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--color-ink-2)]">
              Club ID
            </h2>
            <input
              value={joinId}
              onChange={(e) => setJoinId(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="12"
              className="mt-2 w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 text-sm font-mono outline-none focus:border-[color:var(--color-primary)]"
            />

            <h2 className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--color-ink-2)]">
              Buy-in (harus match pot)
            </h2>
            <input
              value={joinBuyIn}
              onChange={(e) => setJoinBuyIn(e.target.value)}
              inputMode="decimal"
              placeholder="1.00"
              className="mt-2 w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 text-sm font-mono outline-none focus:border-[color:var(--color-primary)]"
            />
            <p className="mt-1 text-[11px] text-[color:var(--color-ink-3)]">CELO</p>

            <button
              type="button"
              onClick={onJoin}
              disabled={!joinId || joining || isConnecting || joinStatus === "pending"}
              className="mt-5 w-full rounded-2xl bg-[color:var(--color-primary)] py-4 text-base font-bold text-white shadow-[var(--shadow-glow-primary)] disabled:opacity-70"
            >
              {joining || joinStatus === "pending"
                ? "Submitting…"
                : !isConnected
                ? "Connect MiniPay"
                : "Gabung Klub"}
            </button>
            {joinHash && (
              <p className="mt-3 text-center">
                <TxExplorerLink hash={joinHash} />
              </p>
            )}
          </section>
        )}

        {err && (
          <p className="mt-3 rounded-xl border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger-soft)] px-3 py-2 text-[11px] text-[color:var(--color-danger)]">
            {err}
          </p>
        )}

        <section className="card mt-4 p-4">
          <div className="flex items-center gap-2">
            <TrophyIcon size={16} className="text-[color:var(--color-amber)]" />
            <p className="text-sm font-bold text-[color:var(--color-ink-0)]">
              Benefit pemenang
            </p>
          </div>
          <p className="mt-2 text-[11px] text-[color:var(--color-ink-2)]">
            Juara weekly auto-mint badge soulbound <b>CLUB_CHAMPION</b> di{" "}
            GambitBadges.sol — ERC-5192 (non-transferable).
          </p>
        </section>

        {address && (
          <p className="mt-3 text-center text-[11px] text-[color:var(--color-ink-2)]">
            Wallet: <span className="font-mono">{truncateAddress(address)}</span>
          </p>
        )}
      </div>
    </main>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-2xl py-2.5 text-sm font-bold transition-colors ${
        active
          ? "bg-[color:var(--color-primary)] text-white"
          : "bg-transparent text-[color:var(--color-ink-2)]"
      }`}
    >
      {children}
    </button>
  );
}
