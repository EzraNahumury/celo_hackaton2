"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { ChevronLeft, SwordsIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { TxExplorerLink, useTxStatus } from "@/components/tx-status";
import { useWallet } from "@/hooks/use-connect";
import { useJoinMatch } from "@/hooks/use-match-escrow";
import { useSession } from "@/hooks/use-session";
import { api } from "@/lib/api";
import { ACTIVE_CHAIN, CONTRACTS, STAKE_TOKEN } from "@/lib/contracts";
import { formatStableLocal, truncateAddress } from "@/lib/format";
import type { LobbyEntry } from "@/types/api";

type Phase = "idle" | "join";

export default function LobbyPage() {
  const router = useRouter();
  const { address, isConnected, connect, isConnecting } = useWallet();
  const { token } = useSession();
  const toast = useToast();

  const [games, setGames] = useState<LobbyEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.getLobby();
      setGames(res.games);
    } catch (e) {
      toast.showError(e);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const tick = () => {
      void load();
    };
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 5000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  return (
    <main className="flex-1">
      <div className="bg-hero rounded-b-[32px] px-5 pt-[max(env(safe-area-inset-top),18px)] pb-8 text-white">
        <header className="flex items-center justify-between">
          <Link
            href="/play"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15"
            aria-label="Back"
          >
            <ChevronLeft size={18} />
          </Link>
          <p className="text-sm font-bold">Lobby</p>
          <Link
            href="/play"
            className="rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold"
          >
            New Match
          </Link>
        </header>
        <div className="mt-5 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/80">
            Waiting matches
          </p>
          <h1 className="mt-1 text-4xl font-extrabold">{games.length}</h1>
          <p className="mt-1 text-xs text-white/80">Live - auto-refresh 5s</p>
        </div>
      </div>

      <div className="px-5 pb-6">
        {!isConnected && (
          <button
            type="button"
            onClick={connect}
            disabled={isConnecting}
            className="mt-4 w-full rounded-2xl bg-[color:var(--color-primary)] py-3 text-sm font-bold text-white shadow-[var(--shadow-glow-primary)]"
          >
            {isConnecting ? "Connecting..." : "Connect MiniPay to join"}
          </button>
        )}

        {loading ? (
          <div className="mt-6 flex items-center justify-center py-10 text-sm text-[color:var(--color-ink-2)]">
            Loading lobby...
          </div>
        ) : games.length === 0 ? (
          <div className="card mt-4 flex flex-col items-center gap-2 p-8 text-center">
            <SwordsIcon size={28} className="text-[color:var(--color-primary)]" />
            <p className="text-sm font-bold text-[color:var(--color-ink-0)]">
              No matches waiting yet
            </p>
            <p className="text-[11px] text-[color:var(--color-ink-2)]">
              Create your own match - openers usually get matched quickly.
            </p>
            <Link
              href="/play"
              className="mt-2 rounded-full bg-[color:var(--color-primary)] px-5 py-2 text-xs font-bold text-white"
            >
              Create Match
            </Link>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {games.map((g) => (
              <MatchRow
                key={g.id}
                game={g}
                myAddress={address?.toLowerCase()}
                authed={!!token}
                onJoined={(gameId) => router.push(`/game?id=${encodeURIComponent(gameId)}`)}
                onNeedConnect={connect}
              />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function MatchRow({
  game,
  myAddress,
  authed,
  onJoined,
  onNeedConnect,
}: {
  game: LobbyEntry;
  myAddress: string | undefined;
  authed: boolean;
  onJoined: (gameId: string) => void;
  onNeedConnect: () => void;
}) {
  const publicClient = usePublicClient({ chainId: ACTIVE_CHAIN.id });
  const { joinMatch, isPending: joining } = useJoinMatch();
  const toast = useToast();

  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const { status } = useTxStatus(txHash);

  const creator = game.white_address ?? game.black_address ?? null;
  const isSelf = !!creator && myAddress === creator.toLowerCase();
  const working = busy || joining || status === "pending";

  const waitForReceipt = async (hash: `0x${string}`) => {
    if (!publicClient) throw new Error("Wallet RPC client is not ready");
    await publicClient.waitForTransactionReceipt({ hash });
  };

  const onJoin = async () => {
    if (!myAddress) {
      onNeedConnect();
      return;
    }
    if (!authed) {
      toast.show({
        title: "Session not ready",
        message: "Wait for backend login to finish then try again.",
        tone: "info",
      });
      return;
    }

    setBusy(true);
    setPhase("idle");

    try {
      const joined = await api.joinGame(game.id);
      const depositTx = joined.depositTx;
      if (!depositTx || depositTx.functionName !== "joinMatch") {
        throw new Error("Backend did not return join instructions");
      }

      const onchainMatchId = depositTx.args[0];
      const escrowAddress = depositTx.to ?? CONTRACTS.matchEscrow;

      if (!escrowAddress || escrowAddress.length !== 42 || escrowAddress === "0x") {
        throw new Error("MatchEscrow address is missing");
      }
      if (onchainMatchId == null) {
        throw new Error("Backend returned an invalid match id");
      }

      // Native CELO stake — skip approve, pass stake as msg.value.
      setPhase("join");
      const joinHash = await joinMatch({
        escrowAddress,
        matchId: BigInt(String(onchainMatchId)),
        stakeWei: BigInt(depositTx.amount),
      });
      setTxHash(joinHash);
      await waitForReceipt(joinHash);

      onJoined(joined.gameId);
    } catch (e) {
      toast.showError(e);
    } finally {
      setPhase("idle");
      setBusy(false);
    }
  };

  return (
    <li className="card flex items-center gap-3 px-4 py-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--color-primary-50)] text-[color:var(--color-primary)]">
        <SwordsIcon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-[color:var(--color-ink-0)]">
          {isSelf ? "Your Match" : "Match"} -{" "}
          <span className="text-[color:var(--color-primary)]">{game.time_control}</span>
        </p>
        <p className="text-[11px] text-[color:var(--color-ink-2)]">
          {creator ? (isSelf ? "You" : truncateAddress(creator)) : "-"} - stake{" "}
          {Number(game.stake_amount).toFixed(2)} {STAKE_TOKEN.symbol}
        </p>
        {txHash && (
          <div className="mt-1">
            <TxExplorerLink hash={txHash} />
          </div>
        )}
      </div>
      {isSelf ? (
        <Link
          href={`/game?id=${encodeURIComponent(game.id)}`}
          className="rounded-full bg-[color:var(--color-amber-soft)] px-3 py-1.5 text-[11px] font-bold text-[color:var(--color-amber)]"
        >
          Enter
        </Link>
      ) : (
        <button
          type="button"
          onClick={onJoin}
          disabled={working}
          className="rounded-full bg-[color:var(--color-primary)] px-4 py-2 text-xs font-bold text-white shadow-sm active:scale-[0.98] disabled:opacity-70"
        >
          {working
            ? phase === "join"
              ? "Joining..."
              : "..."
            : `Join ${formatStableLocal(Number(game.stake_amount), "USD")}`}
        </button>
      )}
    </li>
  );
}
