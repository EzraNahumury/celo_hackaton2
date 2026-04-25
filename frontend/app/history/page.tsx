"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { ChevronRight, ClubIcon, SparkleIcon, TrophyIcon } from "@/components/icons";
import { useWallet } from "@/hooks/use-connect";
import { usePlayerHistory } from "@/hooks/use-player-history";
import { usePlayerStats } from "@/hooks/use-player-stats";
import { useClubHistory, type ClubActivityRow } from "@/hooks/use-club-history";
import { ACTIVE_CHAIN, STAKE_TOKEN } from "@/lib/contracts";
import { formatStableLocal, truncateAddress } from "@/lib/format";
import type {
  PlayerGameRow,
  PlayerTransactionRow,
  WalletAddress,
} from "@/types/api";

type Row = {
  game: PlayerGameRow;
  depositTx?: PlayerTransactionRow;
  payoutTx?: PlayerTransactionRow;
  refundTx?: PlayerTransactionRow;
  // + when payout received, − when only deposit hit, 0 when refunded/ongoing.
  net: number;
  kind: "win" | "lose" | "draw" | "pending";
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fmtDuration(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!isFinite(ms) || ms <= 0) return null;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r.toString().padStart(2, "0")}s`;
}

function classifyRow(
  game: PlayerGameRow,
  me: WalletAddress,
  txs: PlayerTransactionRow[],
): Row {
  const related = txs.filter((t) => t.game_id === game.id);
  const depositTx = related.find((t) => t.tx_type === "deposit");
  const payoutTx = related.find((t) => t.tx_type === "payout");
  const refundTx = related.find((t) => t.tx_type === "refund");

  let kind: Row["kind"] = "pending";
  if (game.status === "completed") {
    if (game.result === "draw" || game.result === "abort") {
      kind = "draw";
    } else if (
      game.winner_address?.toLowerCase() === me.toLowerCase() ||
      (game.result === "white_win" && game.playerColor === "white") ||
      (game.result === "black_win" && game.playerColor === "black")
    ) {
      kind = "win";
    } else {
      kind = "lose";
    }
  } else if (game.status === "cancelled" || game.status === "expired") {
    kind = "draw"; // refunded, neutral
  }

  const deposit = Number(depositTx?.amount ?? game.stake_amount ?? 0);
  const payout = Number(payoutTx?.amount ?? 0);
  const refund = Number(refundTx?.amount ?? 0);

  let net = 0;
  if (kind === "win") net = payout > 0 ? payout - deposit : 0;
  else if (kind === "lose") net = depositTx ? -deposit : 0;
  else if (kind === "draw") net = refund > 0 ? 0 : payout - deposit;
  else net = 0;

  return { game, depositTx, payoutTx, refundTx, net, kind };
}

type ActivityTab = "matches" | "club";

export default function HistoryPage() {
  const { address, isConnected, connect, isConnecting } = useWallet();
  const { entry: stats, loading: statsLoading } = usePlayerStats(address);
  const { games, transactions, loading, error } = usePlayerHistory(address);
  const { rows: clubRows, loading: clubLoading, error: clubError } = useClubHistory(address);

  const [openId, setOpenId] = useState<string | null>(null);
  const [activityTab, setActivityTab] = useState<ActivityTab>("matches");

  const rows: Row[] = useMemo(() => {
    if (!address) return [];
    return games.map((g) => classifyRow(g, address, transactions));
  }, [games, transactions, address]);

  const totalEarned = stats ? Number(stats.totalEarned) : 0;
  const wins = stats?.wins ?? 0;
  const draws = stats?.draws ?? 0;
  const losses = stats?.losses ?? 0;

  const explorer = ACTIVE_CHAIN.blockExplorers?.default.url;

  return (
    <>
      <div className="bg-hero rounded-b-[32px] px-5 pt-[max(env(safe-area-inset-top),18px)] pb-10 text-white">
        <header className="flex items-center justify-center">
          <p className="text-sm font-bold">Activity</p>
        </header>
        <div className="mt-6 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/80">
            Total Earnings
          </p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight">
            {stats ? <>+{formatStableLocal(totalEarned, "IDR")}</> : statsLoading ? "…" : "—"}
          </h1>
          <p className="mt-1 text-xs text-white/80">
            {stats ? `total · on ${ACTIVE_CHAIN.name}` : ACTIVE_CHAIN.name}
          </p>
        </div>
      </div>

      <main className="flex-1 px-5 pb-6">
        <div className="card -mt-6 flex items-center overflow-hidden relative z-10 p-4">
          <Stat
            label="Wins"
            value={stats ? String(wins) : statsLoading ? "…" : "—"}
            accent="text-[color:var(--color-success)]"
          />
          <Divider />
          <Stat
            label="Draws"
            value={stats ? String(draws) : statsLoading ? "…" : "—"}
            accent="text-[color:var(--color-ink-0)]"
          />
          <Divider />
          <Stat
            label="Losses"
            value={stats ? String(losses) : statsLoading ? "…" : "—"}
            accent="text-[color:var(--color-danger)]"
          />
        </div>

        {/* Tab switcher */}
        <div className="card mt-4 flex p-1">
          <TabBtn active={activityTab === "matches"} onClick={() => setActivityTab("matches")}>
            Matches
          </TabBtn>
          <TabBtn active={activityTab === "club"} onClick={() => setActivityTab("club")}>
            Club
          </TabBtn>
        </div>

        {!isConnected ? (
          <div className="card mt-4 flex flex-col items-center gap-3 p-8 text-center">
            <SparkleIcon
              size={28}
              className="animate-spin text-[color:var(--color-primary)]"
              style={{ animationDuration: "2.5s" }}
            />
            <p className="text-sm font-bold text-[color:var(--color-ink-0)]">
              Connect first to see your activity
            </p>
            <button
              type="button"
              onClick={connect}
              disabled={isConnecting}
              className="mt-2 rounded-full bg-[color:var(--color-primary)] px-5 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              {isConnecting ? "Connecting…" : "Connect MiniPay"}
            </button>
          </div>
        ) : activityTab === "matches" ? (
          loading && rows.length === 0 ? (
            <div className="mt-6 flex items-center justify-center py-10 text-sm text-[color:var(--color-ink-2)]">
              Loading history…
            </div>
          ) : error ? (
            <div className="card mt-4 p-4 text-[11px] text-[color:var(--color-danger)]">
              Failed to load: {error}
            </div>
          ) : rows.length === 0 ? (
            <div className="card mt-4 flex flex-col items-center gap-2 p-8 text-center">
              <SparkleIcon
                size={28}
                className="animate-spin text-[color:var(--color-ink-3)]"
                style={{ animationDuration: "2.5s" }}
              />
              <p className="text-sm font-bold text-[color:var(--color-ink-0)]">
                No matches yet
              </p>
              <p className="text-[11px] text-[color:var(--color-ink-2)]">
                Play your first match to see it here.
              </p>
              <Link
                href="/play"
                className="mt-2 rounded-full bg-[color:var(--color-primary)] px-5 py-2 text-xs font-bold text-white"
              >
                Play Now
              </Link>
            </div>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {rows.map((r) => (
                <HistoryRow
                  key={r.game.id}
                  row={r}
                  open={openId === r.game.id}
                  onToggle={() =>
                    setOpenId(openId === r.game.id ? null : r.game.id)
                  }
                  explorer={explorer}
                />
              ))}
            </ul>
          )
        ) : (
          /* Club tab */
          clubLoading ? (
            <div className="mt-6 flex items-center justify-center py-10 text-sm text-[color:var(--color-ink-2)]">
              Loading club activity…
            </div>
          ) : clubError ? (
            <div className="card mt-4 p-4 text-[11px] text-[color:var(--color-danger)]">
              Failed to load: {clubError}
            </div>
          ) : clubRows.length === 0 ? (
            <div className="card mt-4 flex flex-col items-center gap-2 p-8 text-center">
              <ClubIcon
                size={28}
                className="text-[color:var(--color-ink-3)]"
              />
              <p className="text-sm font-bold text-[color:var(--color-ink-0)]">
                No club activity yet
              </p>
              <p className="text-[11px] text-[color:var(--color-ink-2)]">
                Create or join a club to see it here.
              </p>
              <Link
                href="/club"
                className="mt-2 rounded-full bg-[color:var(--color-primary)] px-5 py-2 text-xs font-bold text-white"
              >
                Go to Club
              </Link>
            </div>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {clubRows.map((r) => (
                <ClubActivityRowItem key={r.id} row={r} explorer={explorer} />
              ))}
            </ul>
          )
        )}
      </main>
      <BottomNav />
    </>
  );
}

function HistoryRow({
  row,
  open,
  onToggle,
  explorer,
}: {
  row: Row;
  open: boolean;
  onToggle: () => void;
  explorer: string | undefined;
}) {
  const { game, depositTx, payoutTx, refundTx, net, kind } = row;
  const kindIcon =
    kind === "win" || kind === "lose" ? <TrophyIcon size={18} /> : <SparkleIcon size={18} />;
  const chipClass =
    kind === "win"
      ? "bg-[color:var(--color-success-soft)] text-[color:var(--color-success)]"
      : kind === "lose"
      ? "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]"
      : "bg-[color:var(--color-primary-50)] text-[color:var(--color-primary)]";

  const label =
    game.mode === "bot"
      ? `Bot · ${game.time_control}`
      : `1v1 vs ${game.opponent ? truncateAddress(game.opponent) : "—"}`;

  const statusLabel =
    game.status === "completed"
      ? kind === "win"
        ? "Win"
        : kind === "lose"
        ? "Loss"
        : "Draw"
      : game.status === "waiting"
      ? "Waiting"
      : game.status === "active"
      ? "In progress"
      : game.status === "cancelled" || game.status === "expired"
      ? "Refunded"
      : game.status;

  const deltaClass =
    net > 0
      ? "text-[color:var(--color-success)]"
      : net < 0
      ? "text-[color:var(--color-danger)]"
      : "text-[color:var(--color-ink-2)]";

  return (
    <li className="card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${chipClass}`}
        >
          {kindIcon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[color:var(--color-ink-0)]">
            {label}
          </p>
          <p className="text-[11px] text-[color:var(--color-ink-2)]">
            {game.time_control} · {statusLabel}
          </p>
        </div>
        <p className={`text-sm font-bold ${deltaClass}`}>
          {net > 0 ? "+" : net < 0 ? "−" : ""}
          {formatStableLocal(Math.abs(net), "IDR")}
        </p>
        <span
          aria-hidden
          className={`ml-1 text-[color:var(--color-ink-2)] transition-transform ${
            open ? "rotate-90" : ""
          }`}
        >
          <ChevronRight size={16} />
        </span>
      </button>

      {open && (
        <div className="border-t border-[color:var(--color-border)] bg-[color:var(--color-surface-soft)] px-4 py-3">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
            <DetailRow label="Date" value={fmtDate(game.created_at)} />
            <DetailRow label="Status" value={statusLabel} />
            <DetailRow label="Your color" value={game.playerColor === "white" ? "White" : "Black"} />
            {game.move_count > 0 && (
              <DetailRow label="Moves" value={String(game.move_count)} />
            )}
            {game.end_reason && (
              <DetailRow label="Ended via" value={game.end_reason} />
            )}
            {(() => {
              const dur = fmtDuration(game.started_at, game.ended_at);
              return dur ? <DetailRow label="Duration" value={dur} /> : null;
            })()}
            <DetailRow
              label="Stake"
              value={`${Number(game.stake_amount).toFixed(2)} ${STAKE_TOKEN.symbol}`}
            />
            {payoutTx && (
              <DetailRow
                label="Payout"
                value={`${Number(payoutTx.amount).toFixed(4)} ${STAKE_TOKEN.symbol}`}
              />
            )}
            {refundTx && (
              <DetailRow
                label="Refund"
                value={`${Number(refundTx.amount).toFixed(4)} ${STAKE_TOKEN.symbol}`}
              />
            )}
          </dl>

          <div className="mt-3 flex flex-col gap-1.5">
            {depositTx?.tx_hash && (
              <TxLink label="Deposit" tx={depositTx} explorer={explorer} />
            )}
            {payoutTx?.tx_hash && (
              <TxLink label="Payout" tx={payoutTx} explorer={explorer} />
            )}
            {refundTx?.tx_hash && (
              <TxLink label="Refund" tx={refundTx} explorer={explorer} />
            )}
            {!depositTx && !payoutTx && !refundTx && (
              <p className="text-[11px] italic text-[color:var(--color-ink-3)]">
                No on-chain transactions recorded yet.
              </p>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function TxLink({
  label,
  tx,
  explorer,
}: {
  label: string;
  tx: PlayerTransactionRow;
  explorer: string | undefined;
}) {
  if (!tx.tx_hash) return null;
  const hash = tx.tx_hash;
  const short = `${hash.slice(0, 10)}…${hash.slice(-6)}`;
  const content = (
    <span className="flex items-center justify-between gap-2 rounded-xl border border-[color:var(--color-border)] bg-white px-3 py-2">
      <span className="flex items-center gap-2">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            tx.status === "confirmed"
              ? "bg-[color:var(--color-success)]"
              : tx.status === "pending"
              ? "bg-[color:var(--color-amber)]"
              : "bg-[color:var(--color-danger)]"
          }`}
        />
        <span className="text-[11px] font-bold text-[color:var(--color-ink-0)]">
          {label}
        </span>
        <code className="font-mono text-[10px] text-[color:var(--color-ink-2)]">
          {short}
        </code>
      </span>
      {explorer && (
        <span className="text-[10px] font-bold text-[color:var(--color-primary)]">
          Verify ↗
        </span>
      )}
    </span>
  );
  return explorer ? (
    <a
      href={`${explorer}/tx/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
    >
      {content}
    </a>
  ) : (
    content
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="flex flex-1 flex-col items-center">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-ink-2)]">
        {label}
      </p>
      <p className={`mt-1 text-xl font-extrabold ${accent}`}>{value}</p>
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="h-8 w-px shrink-0 bg-[color:var(--color-border)]" />;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-[color:var(--color-ink-2)]">{label}</dt>
      <dd className="truncate text-right font-semibold text-[color:var(--color-ink-0)]">
        {value}
      </dd>
    </div>
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

function ClubActivityRowItem({
  row,
  explorer,
}: {
  row: ClubActivityRow;
  explorer: string | undefined;
}) {
  const { clubId, kind, buyIn, net } = row;

  const kindLabel =
    kind === "created"
      ? "Created Club"
      : kind === "joined"
        ? "Joined Club"
        : kind === "won"
          ? "Won Club"
          : "2nd in Club";

  const subLabel =
    kind === "created" || kind === "joined"
      ? `Buy-in ${buyIn.toFixed(2)} cUSD`
      : kind === "won"
        ? "1st place · 70% prize"
        : "2nd place · 20% prize";

  const chipClass =
    kind === "won"
      ? "bg-[color:var(--color-success-soft)] text-[color:var(--color-success)]"
      : kind === "placed2nd"
        ? "bg-[color:var(--color-primary-50)] text-[color:var(--color-primary)]"
        : "bg-[color:var(--color-surface-soft)] text-[color:var(--color-ink-2)]";

  const deltaClass =
    net > 0
      ? "text-[color:var(--color-success)]"
      : net < 0
        ? "text-[color:var(--color-danger)]"
        : "text-[color:var(--color-ink-2)]";

  const txUrl = explorer ? `${explorer}/tx/${row.txHash}` : undefined;

  return (
    <li className="card overflow-hidden">
      <div className="flex w-full items-center gap-3 px-4 py-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${chipClass}`}
        >
          {kind === "won" ? (
            <TrophyIcon size={18} />
          ) : (
            <ClubIcon size={18} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[color:var(--color-ink-0)]">
            {kindLabel} #{clubId.toString()}
          </p>
          <p className="text-[11px] text-[color:var(--color-ink-2)]">{subLabel}</p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <p className={`text-sm font-bold ${deltaClass}`}>
            {net > 0 ? "+" : net < 0 ? "−" : ""}
            {formatStableLocal(Math.abs(net), "IDR")}
          </p>
          {txUrl && (
            <a
              href={txUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-bold text-[color:var(--color-primary)]"
            >
              Verify ↗
            </a>
          )}
        </div>
      </div>
    </li>
  );
}
