"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { decodeEventLog, formatUnits } from "viem";
import { useWaitForTransactionReceipt } from "wagmi";
import { ChevronLeft, ClubIcon, TrophyIcon } from "@/components/icons";
import { TxExplorerLink, useTxStatus } from "@/components/tx-status";
import { useWallet } from "@/hooks/use-connect";
import {
  useCreateClub,
  useJoinClub,
  useClub,
  useClubMembers,
  useStartNewWeek,
  type ClubTxPhase,
} from "@/hooks/use-club-vault";
import { useMyClubs } from "@/hooks/use-my-clubs";
import { CLUB_FEE_BPS, CLUB_FIRST_BPS, CLUB_ROLL_BPS, CLUB_SECOND_BPS } from "@/lib/contracts";
import { formatCusd, truncateAddress } from "@/lib/format";
import { clubVaultAbi } from "@/lib/abis/club-vault";

const BUY_IN_OPTIONS = [0.5, 1, 2] as const;
const MAX_MEMBER_OPTIONS = [4, 6, 8] as const;

type Tab = "create" | "join" | "club";
type JoinUiPhase = "idle" | ClubTxPhase;

function safeFormatUnits(value: bigint | null | undefined, decimals = 18) {
  return value !== undefined && value !== null ? formatUnits(value, decimals) : "0";
}

export default function ClubPage() {
  const { address, isConnected, connect, isConnecting } = useWallet();
  const [tab, setTab] = useState<Tab>("create");
  const [buyIn, setBuyIn] = useState<number>(1);
  const [maxMembers, setMaxMembers] = useState<number>(6);
  const [joinId, setJoinId] = useState<string>("");
  const [joinBuyIn, setJoinBuyIn] = useState<string>("1");
  const [err, setErr] = useState<string | null>(null);
  const [myClubId, setMyClubId] = useState<bigint | undefined>();
  const [clubIdInput, setClubIdInput] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [joinPhase, setJoinPhase] = useState<JoinUiPhase>("idle");

  const { clubs: myClubs, loading: myClubsLoading } = useMyClubs(address);

  const { createClub, isPending: creating, hash: createHash } = useCreateClub();
  const { joinClub, isPending: joining, hash: joinHash } = useJoinClub();
  const { startNewWeek, isPending: startingWeek, hash: newWeekHash } = useStartNewWeek();
  const { status: createStatus } = useTxStatus(createHash);
  const { status: joinStatus } = useTxStatus(joinHash);

  const { data: createReceipt } = useWaitForTransactionReceipt({ hash: createHash });
  const { data: joinReceipt } = useWaitForTransactionReceipt({ hash: joinHash });

  useEffect(() => {
    if (!createReceipt) return;
    for (const log of createReceipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: clubVaultAbi,
          eventName: "ClubCreated",
          data: log.data,
          topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
        });
        setMyClubId(decoded.args.clubId);
        setTab("club");
        break;
      } catch {}
    }
  }, [createReceipt]);

  useEffect(() => {
    if (!joinReceipt || !joinId) return;
    setJoinPhase("idle");
    setMyClubId(BigInt(joinId));
    setTab("club");
  }, [joinReceipt, joinId]);

  const { data: clubData, refetch: refetchClub } = useClub(myClubId);
  const { data: membersData, refetch: refetchMembers } = useClubMembers(myClubId);

  // Preview club data when user types a join ID — used to block duplicate joins
  const joinClubIdBigInt = joinId ? BigInt(joinId) : undefined;
  const { data: joinClubPreview } = useClub(joinClubIdBigInt);
  const { data: joinClubMembers } = useClubMembers(joinClubIdBigInt);
  const isAlreadyMember = !!address && !!joinClubMembers?.some(
    (m) => m.toLowerCase() === address.toLowerCase(),
  );
  const isJoinCreator = !!address && joinClubPreview?.creator?.toLowerCase() === address.toLowerCase();
  const cannotJoin = isAlreadyMember || isJoinCreator;

  const { data: newWeekReceipt } = useWaitForTransactionReceipt({ hash: newWeekHash });
  useEffect(() => {
    if (!newWeekReceipt) return;
    refetchClub();
    refetchMembers();
  }, [newWeekReceipt, refetchClub, refetchMembers]);

  const onCreate = async () => {
    setErr(null);
    try {
      if (!isConnected) return connect();
      await createClub({ maxMembers, buyIn });
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const onJoin = async () => {
    setErr(null);
    try {
      if (!isConnected) return connect();
      setJoinPhase("approve");
      await joinClub({
        clubId: BigInt(joinId),
        buyIn: parseFloat(joinBuyIn),
        onPhaseChange: setJoinPhase,
      });
    } catch (e) {
      setJoinPhase("idle");
      setErr((e as Error).message);
    }
  };

  const onStartNewWeek = async () => {
    if (!myClubId || !clubData) return;
    setErr(null);
    try {
      await startNewWeek({ clubId: myClubId, buyIn: Number(safeFormatUnits(clubData.buyIn, 18)) });
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const onCopyId = () => {
    if (!myClubId) return;
    navigator.clipboard.writeText(myClubId.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clubBuyInCusd = Number(safeFormatUnits(clubData?.buyIn, 18));
  const clubPotCusd = Number(safeFormatUnits(clubData?.pot, 18));
  const isCreator = !!address && clubData?.creator?.toLowerCase() === address.toLowerCase();
  const isActive = clubData?.state === 0;
  const memberCount = membersData?.length ?? 0;
  const spotsLeft = clubData ? Number(clubData.maxMembers) - memberCount : 0;
  const joinWorking = joinPhase !== "idle" || joining || isConnecting || joinStatus === "pending" || cannotJoin;
  const joinButtonLabel = !isConnected
    ? "Connect MiniPay"
    : isJoinCreator
      ? "You are the club creator"
      : isAlreadyMember
        ? "Already a member"
        : joinPhase === "approve"
          ? "Approving CELO..."
          : joinPhase === "approve_wait"
            ? "Waiting for confirmation..."
            : joinPhase === "write" || joining || joinStatus === "pending"
              ? "Joining club..."
              : "Join Club";
  const joinPhaseHint =
    joinPhase === "approve"
      ? "Sending token approval transaction."
      : joinPhase === "approve_wait"
        ? "Approve sent. Waiting for on-chain confirmation before joining."
        : joinPhase === "write"
          ? "Approval confirmed. Sending join transaction now."
          : null;

  return (
    <main className="flex-1">
      <div className="bg-hero rounded-b-[32px] px-5 pt-[max(env(safe-area-inset-top),18px)] pb-10 text-white">
        <header className="flex items-center justify-between">
          <Link
            href="/home"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15"
            aria-label="Back"
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
            4-8 members · split {CLUB_FIRST_BPS / 100}/{CLUB_SECOND_BPS / 100}/{CLUB_ROLL_BPS / 100} · fee{" "}
            {CLUB_FEE_BPS / 100}%
          </p>
        </div>
      </div>

      <div className="px-5 pb-8">
        <div className="card -mt-6 relative z-10 flex p-1">
          <TabBtn active={tab === "create"} onClick={() => setTab("create")}>Create</TabBtn>
          <TabBtn active={tab === "join"} onClick={() => setTab("join")}>Join</TabBtn>
          <TabBtn active={tab === "club"} onClick={() => setTab("club")}>My Club</TabBtn>
        </div>

        {tab === "create" && (
          <section className="card mt-4 p-5">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--color-ink-2)]">Weekly buy-in</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {BUY_IN_OPTIONS.map((b) => {
                const active = b === buyIn;
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBuyIn(b)}
                    className={`rounded-2xl border-2 px-3 py-4 text-left ${active ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-50)]" : "border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)]"}`}
                  >
                    <p className="text-lg font-bold text-[color:var(--color-ink-0)]">{b.toFixed(2)} CELO</p>
                  </button>
                );
              })}
            </div>

            <h2 className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--color-ink-2)]">Member capacity (4-8)</h2>
            <div className="mt-3 flex gap-2">
              {MAX_MEMBER_OPTIONS.map((m) => {
                const active = m === maxMembers;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMaxMembers(m)}
                    className={`flex-1 rounded-full border px-4 py-2 text-sm font-bold ${active ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-white" : "border-[color:var(--color-border)] bg-white text-[color:var(--color-ink-1)]"}`}
                  >
                    {m} members
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl bg-[color:var(--color-surface-soft)] p-3 text-[11px] text-[color:var(--color-ink-2)]">
              Full pot: {formatCusd(buyIn * maxMembers)} · winner gets{" "}
              <b className="text-[color:var(--color-success)]">
                {formatCusd(buyIn * maxMembers * (CLUB_FIRST_BPS / 10_000) * (1 - CLUB_FEE_BPS / 10_000))}
              </b>. 10% carries over to next week.
            </div>

            <button
              type="button"
              onClick={onCreate}
              disabled={creating || isConnecting || createStatus === "pending"}
              className="mt-5 w-full rounded-2xl bg-[color:var(--color-primary)] py-4 text-base font-bold text-white shadow-[var(--shadow-glow-primary)] disabled:opacity-70"
            >
              {creating || createStatus === "pending" ? "Submitting..." : !isConnected ? "Connect MiniPay" : `Create Club · ${formatCusd(buyIn)}`}
            </button>
            {createHash && <p className="mt-3 text-center"><TxExplorerLink hash={createHash} /></p>}
          </section>
        )}

        {tab === "join" && (
          <section className="card mt-4 p-5">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--color-ink-2)]">Club ID</h2>
            <input
              value={joinId}
              onChange={(e) => setJoinId(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="e.g. 3"
              className="mt-2 w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 text-sm font-mono outline-none focus:border-[color:var(--color-primary)]"
            />

            <h2 className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--color-ink-2)]">Buy-in (must match club)</h2>
            <input
              value={joinBuyIn}
              onChange={(e) => setJoinBuyIn(e.target.value)}
              inputMode="decimal"
              placeholder="1.00"
              className="mt-2 w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 text-sm font-mono outline-none focus:border-[color:var(--color-primary)]"
            />
            <p className="mt-1 text-[11px] text-[color:var(--color-ink-3)]">CELO</p>

            {cannotJoin && joinId && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                <p>
                  {isJoinCreator
                    ? "You created this club. "
                    : "You are already a member of this club. "}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMyClubId(BigInt(joinId));
                    setTab("club");
                  }}
                  className="mt-1 font-bold underline"
                >
                  View club &rarr;
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onJoin}
              disabled={!joinId || joinWorking}
              className="mt-5 w-full rounded-2xl bg-[color:var(--color-primary)] py-4 text-base font-bold text-white shadow-[var(--shadow-glow-primary)] disabled:opacity-70"
            >
              {joinButtonLabel}
            </button>
            {joinPhaseHint && (
              <p className="mt-2 text-center text-[11px] text-[color:var(--color-ink-2)]">
                {joinPhaseHint}
              </p>
            )}
            {joinHash && <p className="mt-3 text-center"><TxExplorerLink hash={joinHash} /></p>}
          </section>
        )}

        {tab === "club" && (
          <section className="card mt-4 p-5">
            {!myClubId ? (
              /* ── Club list ─────────────────────────────────────── */
              myClubsLoading ? (
                <p className="py-4 text-center text-sm text-[color:var(--color-ink-2)]">Loading your clubs…</p>
              ) : myClubs.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <ClubIcon size={28} className="text-[color:var(--color-ink-3)]" />
                  <p className="text-sm font-bold text-[color:var(--color-ink-0)]">No clubs yet</p>
                  <p className="text-[11px] text-[color:var(--color-ink-2)]">Create a club or join one using its ID.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {myClubs.map((c) => {
                    const buyInCusd = Number(formatUnits(c.data.buyIn, 18));
                    const isActive = c.data.state === 0;
                    return (
                      <button
                        key={c.clubId.toString()}
                        type="button"
                        onClick={() => setMyClubId(c.clubId)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)] px-4 py-3 text-left transition-colors active:bg-[color:var(--color-primary-50)]"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--color-primary-50)] text-[color:var(--color-primary)]">
                          <ClubIcon size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-[color:var(--color-ink-0)]">
                            Club #{c.clubId.toString()}
                            {c.isCreator && (
                              <span className="ml-2 text-[10px] font-semibold text-[color:var(--color-primary)]">Creator</span>
                            )}
                          </p>
                          <p className="text-[11px] text-[color:var(--color-ink-2)]">
                            {c.memberCount}/{c.data.maxMembers.toString()} members · {formatCusd(buyInCusd)} buy-in
                          </p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {isActive ? "Active" : "Closed"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )
            ) : !clubData ? (
              <p className="py-4 text-center text-sm text-[color:var(--color-ink-2)]">Loading club...</p>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-2xl bg-[color:var(--color-surface-soft)] px-4 py-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--color-ink-3)]">Club ID</p>
                    <p className="text-3xl font-extrabold text-[color:var(--color-ink-0)]">#{myClubId.toString()}</p>
                  </div>
                  <button
                    type="button"
                    onClick={onCopyId}
                    className="rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2 text-xs font-bold text-[color:var(--color-ink-1)]"
                  >
                    {copied ? "Copied!" : "Copy ID"}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {isActive ? "Active" : "Closed"}
                  </span>
                  {isCreator && (
                    <span className="rounded-full bg-[color:var(--color-primary-50)] px-3 py-1 text-xs font-bold text-[color:var(--color-primary)]">
                      You are the creator
                    </span>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-[color:var(--color-surface-soft)] p-3">
                    <p className="text-[10px] uppercase tracking-wide text-[color:var(--color-ink-3)]">Pot</p>
                    <p className="text-base font-bold text-[color:var(--color-success)]">{formatCusd(clubPotCusd)}</p>
                  </div>
                  <div className="rounded-2xl bg-[color:var(--color-surface-soft)] p-3">
                    <p className="text-[10px] uppercase tracking-wide text-[color:var(--color-ink-3)]">Buy-in</p>
                    <p className="text-base font-bold text-[color:var(--color-ink-0)]">{formatCusd(clubBuyInCusd)}</p>
                  </div>
                </div>

                <h2 className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--color-ink-2)]">
                  Members {memberCount}/{clubData.maxMembers.toString()}
                </h2>
                <div className="mt-2 space-y-1">
                  {membersData?.map((m) => (
                    <div key={m} className="flex items-center gap-2 rounded-xl bg-[color:var(--color-surface-soft)] px-3 py-2">
                      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-green-400" />
                      <span className="flex-1 font-mono text-xs text-[color:var(--color-ink-1)]">{truncateAddress(m)}</span>
                      {m.toLowerCase() === clubData.creator.toLowerCase() && (
                        <span className="text-[10px] text-[color:var(--color-ink-3)]">creator</span>
                      )}
                      {m.toLowerCase() === address?.toLowerCase() && (
                        <span className="text-[10px] font-bold text-[color:var(--color-primary)]">you</span>
                      )}
                    </div>
                  ))}
                  {spotsLeft > 0 && (
                    <p className="py-1 text-center text-[11px] text-[color:var(--color-ink-3)]">
                      {spotsLeft} spot{spotsLeft !== 1 ? "s" : ""} remaining
                    </p>
                  )}
                </div>

                <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--color-border)] p-3 text-center">
                  <p className="text-[11px] text-[color:var(--color-ink-2)]">Share this ID with friends to join</p>
                  <p className="mt-1 text-2xl font-extrabold text-[color:var(--color-primary)]">#{myClubId.toString()}</p>
                  <button
                    type="button"
                    onClick={onCopyId}
                    className="mt-2 rounded-full bg-[color:var(--color-primary-50)] px-4 py-1.5 text-xs font-bold text-[color:var(--color-primary)]"
                  >
                    {copied ? "Copied!" : "Copy Club ID"}
                  </button>
                </div>

                {isCreator && !isActive && (
                  <button
                    type="button"
                    onClick={onStartNewWeek}
                    disabled={startingWeek}
                    className="mt-4 w-full rounded-2xl bg-[color:var(--color-primary)] py-4 text-base font-bold text-white shadow-[var(--shadow-glow-primary)] disabled:opacity-70"
                  >
                    {startingWeek ? "Starting..." : "Start New Week"}
                  </button>
                )}
                {newWeekHash && <p className="mt-2 text-center"><TxExplorerLink hash={newWeekHash} /></p>}

                <button
                  type="button"
                  onClick={() => {
                    setMyClubId(undefined);
                    setClubIdInput("");
                  }}
                  className="mt-4 w-full text-center text-xs text-[color:var(--color-ink-3)] underline"
                >
                  ← Back to my clubs
                </button>
              </>
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
            <p className="text-sm font-bold text-[color:var(--color-ink-0)]">Winner benefit</p>
          </div>
          <p className="mt-2 text-[11px] text-[color:var(--color-ink-2)]">
            Weekly winner auto-mints a soulbound <b>CLUB_CHAMPION</b> badge on{" "}
            GambitBadges.sol - ERC-5192 (non-transferable).
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

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-2xl py-2.5 text-sm font-bold transition-colors ${active ? "bg-[color:var(--color-primary)] text-white" : "bg-transparent text-[color:var(--color-ink-2)]"}`}
    >
      {children}
    </button>
  );
}
