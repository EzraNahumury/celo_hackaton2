-- ============================================================
-- Puzzle redesign migration
-- Run this in Supabase SQL Editor before deploying the new code
-- ============================================================

-- Lichess puzzle cache (one row per unique puzzle fetched from Lichess)
CREATE TABLE IF NOT EXISTS lichess_puzzles (
  id          TEXT PRIMARY KEY,               -- Lichess puzzle ID, e.g. "pId3s"
  fen         TEXT NOT NULL,                  -- board position at puzzle start
  to_move     TEXT NOT NULL DEFAULT 'white',  -- 'white' | 'black'
  solution    JSONB NOT NULL,                 -- [playerMove, opponentMove, playerMove, ...]
  rating      INT DEFAULT 1500,              -- Lichess puzzle rating
  themes      TEXT[],                         -- e.g. ['fork', 'mateIn2']
  fetched_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Per-player puzzle sessions (one row per puzzle attempt)
CREATE TABLE IF NOT EXISTS puzzle_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  puzzle_id       TEXT NOT NULL REFERENCES lichess_puzzles(id),
  player_address  TEXT NOT NULL,
  submitted_moves JSONB,                      -- player moves only (even-index entries)
  correct         BOOLEAN NOT NULL DEFAULT false,
  used_hint       BOOLEAN NOT NULL DEFAULT false,
  prize_paid      BOOLEAN NOT NULL DEFAULT false,
  tx_hash         TEXT,                       -- cUSD transfer tx hash if prize was paid
  solve_time_ms   INT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for daily prize counting and seen-puzzle lookups
CREATE INDEX IF NOT EXISTS idx_puzzle_sessions_player_date
  ON puzzle_sessions(player_address, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_puzzle_sessions_player_puzzle
  ON puzzle_sessions(player_address, puzzle_id);

CREATE INDEX IF NOT EXISTS idx_puzzle_sessions_prize
  ON puzzle_sessions(player_address, prize_paid, created_at DESC);
