import { supabase } from "../config/supabase";
import { normalizeAddress } from "../utils/helpers";
import { logger } from "../utils/logger";
import { Player } from "../types";

export async function getOrCreatePlayer(walletAddress: string): Promise<Player> {
  const address = normalizeAddress(walletAddress);

  const { data: existing } = await supabase
    .from("players")
    .select("*")
    .eq("wallet_address", address)
    .single();

  if (existing) {
    await supabase
      .from("players")
      .update({ last_seen: new Date().toISOString() })
      .eq("wallet_address", address);
    return existing as Player;
  }

  const { data: newPlayer, error } = await supabase
    .from("players")
    .insert({ wallet_address: address })
    .select()
    .single();

  if (error) {
    logger.error("Failed to create player", { address, error: error.message });
    throw new Error("Failed to create player");
  }

  return newPlayer as Player;
}

export async function getPlayer(walletAddress: string): Promise<Player | null> {
  const { data } = await supabase
    .from("players")
    .select("*")
    .eq("wallet_address", normalizeAddress(walletAddress))
    .single();

  return data as Player | null;
}

export async function updatePlayerStats(
  address: string,
  result: "win" | "loss" | "draw",
  earned: number = 0
): Promise<void> {
  const addr = normalizeAddress(address);
  const player = await getPlayer(addr);
  if (!player) return;

  const updates: Record<string, unknown> = {};
  if (result === "win") {
    updates.wins = player.wins + 1;
  } else if (result === "loss") {
    updates.losses = player.losses + 1;
  } else {
    updates.draws = player.draws + 1;
  }

  if (earned > 0) {
    updates.total_earned = Number(player.total_earned) + earned;
  }

  await supabase.from("players").update(updates).eq("wallet_address", addr);
}

export async function updatePlayerRating(address: string, newRating: number): Promise<void> {
  await supabase
    .from("players")
    .update({ rating: newRating })
    .eq("wallet_address", normalizeAddress(address));
}
