import { supabase } from "../config/supabase";
import { validateMove, getTurn } from "./chessEngine";
import { switchTurn as clockSwitchTurn, startClock, stopClock, getTimeRemaining } from "./clockService";
import { calculateElo } from "./eloService";
import { getPlayer, updatePlayerStats, updatePlayerRating } from "./playerService";
import { resolveGame as resolveOnChain } from "./escrowService";
import { getBestMove } from "./stockfish";
import { normalizeAddress, generateOnchainGameId, parseTimeControl } from "../utils/helpers";
import { logger } from "../utils/logger";
import { Game, MoveResult, GameResult } from "../types";

const BOT_ADDRESS = "0x0000000000000000000000000000000000000b07";

async function ensureBotPlayer(): Promise<void> {
  const { data } = await supabase
    .from("players")
    .select("wallet_address")
    .eq("wallet_address", BOT_ADDRESS)
    .single();

  if (!data) {
    await supabase.from("players").insert({
      wallet_address: BOT_ADDRESS,
      username: "Stockfish Bot",
      rating: 1500,
    });
    logger.info("Bot player created");
  }
}

export async function createGame(
  playerAddress: string,
  stake: number,
  timeControl: string,
  color: "white" | "black" | "random",
  mode: "pvp" | "bot"
): Promise<Game> {
  const address = normalizeAddress(playerAddress);
  const { timeMs } = parseTimeControl(timeControl);

  let whiteAddress: string | null = null;
  let blackAddress: string | null = null;

  if (color === "random") {
    if (Math.random() < 0.5) {
      whiteAddress = address;
    } else {
      blackAddress = address;
    }
  } else if (color === "white") {
    whiteAddress = address;
  } else {
    blackAddress = address;
  }

  const isBotGame = mode === "bot";
  if (isBotGame) {
    await ensureBotPlayer();
    if (whiteAddress === null) whiteAddress = BOT_ADDRESS;
    if (blackAddress === null) blackAddress = BOT_ADDRESS;
  }

  const gameData: Record<string, unknown> = {
    white_address: whiteAddress,
    black_address: blackAddress,
    status: isBotGame ? "active" : "waiting",
    mode,
    stake_amount: stake,
    time_control: timeControl,
    white_time_ms: timeMs,
    black_time_ms: timeMs,
    expires_at: isBotGame
      ? null
      : new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    started_at: isBotGame ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from("games")
    .insert(gameData)
    .select()
    .single();

  if (error) {
    logger.error("Failed to create game", { error: error.message });
    throw new Error("Failed to create game");
  }

  const game = data as Game;

  // Generate onchain game id
  const onchainGameId = generateOnchainGameId(game.id);
  await supabase
    .from("games")
    .update({ onchain_game_id: onchainGameId })
    .eq("id", game.id);

  game.onchain_game_id = onchainGameId;

  if (isBotGame) {
    startClock(game.id, timeControl, (color) => handleTimeout(game.id, color));
  }

  logger.info("Game created", { gameId: game.id, mode, stake });
  return game;
}

export async function joinGame(gameId: string, playerAddress: string): Promise<Game> {
  const address = normalizeAddress(playerAddress);

  const { data: game, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single();

  if (error || !game) throw new Error("GAME_NOT_FOUND");
  if (game.status !== "waiting") throw new Error("GAME_FULL");
  if (game.white_address === address || game.black_address === address) {
    throw new Error("GAME_FULL");
  }

  const updates: Record<string, unknown> = {
    status: "active",
    started_at: new Date().toISOString(),
  };

  if (!game.white_address) {
    updates.white_address = address;
  } else {
    updates.black_address = address;
  }

  const { data: updated, error: updateError } = await supabase
    .from("games")
    .update(updates)
    .eq("id", gameId)
    .select()
    .single();

  if (updateError) throw new Error("Failed to join game");

  startClock(gameId, updated.time_control, (color) => handleTimeout(gameId, color));

  logger.info("Player joined game", { gameId, player: address });
  return updated as Game;
}

export async function makeMove(
  gameId: string,
  playerAddress: string,
  uciMove: string
): Promise<MoveResult> {
  const address = normalizeAddress(playerAddress);

  const { data: game } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single();

  if (!game) return { valid: false, reason: "Game not found" };
  if (game.status !== "active") return { valid: false, reason: "Game not active" };

  const turn = getTurn(game.fen);
  const isWhite = game.white_address === address;
  const isBlack = game.black_address === address;

  if ((turn === "white" && !isWhite) || (turn === "black" && !isBlack)) {
    return { valid: false, reason: "Not your turn" };
  }

  const result = validateMove(game.fen, uciMove);
  if (!result.valid) {
    return { valid: false, reason: result.reason };
  }

  // Switch clock
  const times = clockSwitchTurn(gameId);
  const whiteTimeMs = times?.whiteTimeMs ?? game.white_time_ms;
  const blackTimeMs = times?.blackTimeMs ?? game.black_time_ms;
  const moveNumber = game.move_count + 1;

  // Update game
  const gameUpdates: Record<string, unknown> = {
    fen: result.newFen,
    move_count: moveNumber,
    white_time_ms: whiteTimeMs,
    black_time_ms: blackTimeMs,
  };

  if (result.gameOver && result.result) {
    gameUpdates.status = "completed";
    gameUpdates.result = result.result;
    gameUpdates.ended_at = new Date().toISOString();
    gameUpdates.end_reason = "checkmate";
    if (result.result === "white_win") gameUpdates.winner_address = game.white_address;
    else if (result.result === "black_win") gameUpdates.winner_address = game.black_address;
    if (result.result === "draw") gameUpdates.end_reason = "draw";
    stopClock(gameId);
  }

  await supabase.from("games").update(gameUpdates).eq("id", gameId);

  // Insert move
  await supabase.from("moves").insert({
    game_id: gameId,
    player_address: address,
    move_number: moveNumber,
    uci_move: uciMove,
    fen_after: result.newFen,
    time_remaining_ms: isWhite ? whiteTimeMs : blackTimeMs,
  });

  // Handle end-of-game
  if (result.gameOver && result.result) {
    await handleGameEnd(game, result.result as GameResult);
  }

  const moveResult: MoveResult = {
    valid: true,
    fen: result.newFen,
    whiteTimeMs,
    blackTimeMs,
    moveNumber,
    gameOver: result.gameOver,
    result: result.result as GameResult | undefined,
    isBotGame: game.mode === "bot",
  };

  // Bot response
  if (game.mode === "bot" && !result.gameOver) {
    const botAddress = game.white_address === BOT_ADDRESS ? game.white_address : game.black_address;
    if (botAddress === BOT_ADDRESS) {
      try {
        const botMove = await getBestMove(result.newFen!, 3);
        const botResult = await makeMove(gameId, BOT_ADDRESS, botMove);
        if (botResult.valid) {
          moveResult.fen = botResult.fen;
          moveResult.whiteTimeMs = botResult.whiteTimeMs;
          moveResult.blackTimeMs = botResult.blackTimeMs;
          moveResult.moveNumber = botResult.moveNumber;
          moveResult.gameOver = botResult.gameOver;
          moveResult.result = botResult.result;
        }
      } catch (err) {
        logger.error("Bot move failed", { error: (err as Error).message });
      }
    }
  }

  return moveResult;
}

export async function resignGame(
  gameId: string,
  playerAddress: string
): Promise<{ result: GameResult; payoutTxHash: string | null }> {
  const address = normalizeAddress(playerAddress);

  const { data: game } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single();

  if (!game) throw new Error("GAME_NOT_FOUND");
  if (game.status !== "active") throw new Error("GAME_ALREADY_ENDED");

  const isWhite = game.white_address === address;
  const result: GameResult = isWhite ? "black_win" : "white_win";
  const winnerAddress = isWhite ? game.black_address : game.white_address;

  await supabase
    .from("games")
    .update({
      status: "completed",
      result,
      winner_address: winnerAddress,
      end_reason: "resignation",
      ended_at: new Date().toISOString(),
    })
    .eq("id", gameId);

  stopClock(gameId);
  await handleGameEnd(game, result);

  return { result, payoutTxHash: null };
}

async function handleGameEnd(game: Game, result: GameResult): Promise<void> {
  if (!game.white_address || !game.black_address) return;
  if (game.mode === "bot") return; // No ELO/payout for bot games

  const white = await getPlayer(game.white_address);
  const black = await getPlayer(game.black_address);
  if (!white || !black) return;

  const isDraw = result === "draw";
  const winnerAddr = result === "white_win" ? game.white_address : game.black_address;
  const loserAddr = result === "white_win" ? game.black_address : game.white_address;

  // Update ELO
  const elo = calculateElo(
    isDraw ? white.rating : (result === "white_win" ? white.rating : black.rating),
    isDraw ? black.rating : (result === "white_win" ? black.rating : white.rating),
    isDraw
  );

  if (isDraw) {
    await updatePlayerStats(game.white_address, "draw");
    await updatePlayerStats(game.black_address, "draw");
    await updatePlayerRating(game.white_address, elo.newWinnerRating);
    await updatePlayerRating(game.black_address, elo.newLoserRating);
  } else {
    const stake = Number(game.stake_amount);
    const payout = stake * 2 * 0.95; // 5% fee
    await updatePlayerStats(winnerAddr, "win", payout);
    await updatePlayerStats(loserAddr, "loss");
    await updatePlayerRating(
      winnerAddr,
      result === "white_win" ? elo.newWinnerRating : elo.newLoserRating
    );
    await updatePlayerRating(
      loserAddr,
      result === "white_win" ? elo.newLoserRating : elo.newWinnerRating
    );
  }
}

async function handleTimeout(gameId: string, color: "white" | "black"): Promise<void> {
  const result: GameResult = color === "white" ? "black_win" : "white_win";

  const { data: game } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single();

  if (!game || game.status !== "active") return;

  const winnerAddress = color === "white" ? game.black_address : game.white_address;

  await supabase
    .from("games")
    .update({
      status: "completed",
      result,
      winner_address: winnerAddress,
      end_reason: "timeout",
      ended_at: new Date().toISOString(),
      ...(color === "white" ? { white_time_ms: 0 } : { black_time_ms: 0 }),
    })
    .eq("id", gameId);

  await handleGameEnd(game as Game, result);
  logger.info("Game ended by timeout", { gameId, color });
}

export async function getGame(gameId: string): Promise<Game | null> {
  const { data } = await supabase.from("games").select("*").eq("id", gameId).single();
  if (!data) return null;

  // Attach live clock times
  const times = getTimeRemaining(gameId);
  if (times) {
    data.white_time_ms = times.whiteTimeMs;
    data.black_time_ms = times.blackTimeMs;
  }

  return data as Game;
}

export async function getLobby(
  stake?: number,
  timeControl?: string
): Promise<Game[]> {
  let query = supabase
    .from("games")
    .select("*")
    .eq("status", "waiting")
    .eq("mode", "pvp")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (stake) query = query.eq("stake_amount", stake);
  if (timeControl) query = query.eq("time_control", timeControl);

  const { data } = await query;
  return (data || []) as Game[];
}

export async function getGameMoves(gameId: string) {
  const { data } = await supabase
    .from("moves")
    .select("*")
    .eq("game_id", gameId)
    .order("move_number", { ascending: true });
  return data || [];
}
