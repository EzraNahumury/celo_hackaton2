import { supabase } from "../config/supabase";
import { normalizeAddress } from "../utils/helpers";
import { logger } from "../utils/logger";

export function assignColors(
  creatorPreference: "white" | "black" | "random"
): { creatorColor: "white" | "black"; joinerColor: "white" | "black" } {
  let creatorColor: "white" | "black";

  if (creatorPreference === "random") {
    creatorColor = Math.random() < 0.5 ? "white" : "black";
  } else {
    creatorColor = creatorPreference;
  }

  return {
    creatorColor,
    joinerColor: creatorColor === "white" ? "black" : "white",
  };
}

export async function findMatch(
  playerAddress: string,
  stake: number,
  timeControl: string
): Promise<string | null> {
  const address = normalizeAddress(playerAddress);

  const { data: games } = await supabase
    .from("games")
    .select("id, white_address, black_address")
    .eq("status", "waiting")
    .eq("stake_amount", stake)
    .eq("time_control", timeControl)
    .eq("mode", "pvp")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(10);

  if (!games || games.length === 0) return null;

  // Find a game not created by this player
  const match = games.find(
    (g) => g.white_address !== address && g.black_address !== address
  );

  return match?.id || null;
}
