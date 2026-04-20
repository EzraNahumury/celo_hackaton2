// Turn raw viem/wagmi/API errors into short, friendly English messages
// for the UI. Falls back to the original message when nothing matches.

export type FriendlyError = {
  title: string;
  message: string;
  hint?: string;
  tone: "warning" | "danger" | "info";
};

export function humanizeError(err: unknown): FriendlyError {
  const raw =
    typeof err === "string"
      ? err
      : err instanceof Error
      ? err.message
      : String(err ?? "");
  const lc = raw.toLowerCase();

  // User-initiated cancellations — not really errors.
  if (
    lc.includes("user rejected") ||
    lc.includes("user denied") ||
    lc.includes("rejected the request")
  ) {
    return {
      title: "Transaction cancelled",
      message: "You rejected the signature in your wallet.",
      tone: "info",
    };
  }

  // Insufficient balance (gas + value).
  if (lc.includes("insufficient funds") || lc.includes("exceeds balance")) {
    return {
      title: "Insufficient balance",
      message: "You don't have enough CELO for the stake + gas.",
      hint: "Pick a smaller stake or top up from the Celo Sepolia faucet.",
      tone: "danger",
    };
  }

  // Public RPC being grumpy.
  if (
    lc.includes("too many errors") ||
    lc.includes("requested resource not available") ||
    lc.includes("rate limit") ||
    lc.includes("429") ||
    lc.includes("econnreset") ||
    lc.includes("fetch failed")
  ) {
    return {
      title: "RPC is busy",
      message: "The Celo Sepolia endpoint is rate-limited. Wait a moment and try again.",
      hint: "If this happens often, switch your wallet's RPC to forno.celo-sepolia.celo-testnet.org.",
      tone: "warning",
    };
  }

  // Auth / session errors from BE.
  if (lc.includes("auth_required") || lc.includes("401")) {
    return {
      title: "Session expired",
      message: "Your backend session ran out. Disconnect and reconnect your wallet.",
      tone: "warning",
    };
  }
  if (lc.includes("auth_invalid") || lc.includes("403")) {
    return {
      title: "Invalid token",
      message: "Backend session is invalid. Try reconnecting your wallet.",
      tone: "warning",
    };
  }

  // BE-specific code prefixes the message (e.g. "GAME_FULL: ...")
  if (lc.startsWith("game_full")) {
    return { title: "Match is full", message: "Someone joined first.", tone: "warning" };
  }
  if (lc.startsWith("game_expired")) {
    return {
      title: "Match expired",
      message: "This match waited more than 5 minutes.",
      tone: "warning",
    };
  }
  if (lc.startsWith("invalid_move") || lc.startsWith("not_your_turn")) {
    return { title: "Move rejected", message: raw, tone: "warning" };
  }
  if (lc.startsWith("stake_not_deposited")) {
    return {
      title: "Stake not deposited",
      message: "Your on-chain deposit hasn't been confirmed yet.",
      tone: "warning",
    };
  }

  // Contract simulation failed / revert.
  if (lc.includes("reverted") || lc.includes("execution reverted")) {
    return {
      title: "Rejected by smart contract",
      message: "The contract rejected this transaction.",
      hint: raw.split("\n")[0],
      tone: "danger",
    };
  }

  // Chain mismatch.
  if (lc.includes("chain mismatch") || lc.includes("wrong chain")) {
    return {
      title: "Wrong network",
      message: "Your wallet isn't on Celo Sepolia. Switch the network in your wallet.",
      tone: "warning",
    };
  }

  // Fallback — take only first line/sentence so we don't dump 20 lines of trace.
  const firstLine = raw.split("\n")[0].slice(0, 200);
  return {
    title: "Something went wrong",
    message: firstLine || "Please try again shortly.",
    tone: "danger",
  };
}
