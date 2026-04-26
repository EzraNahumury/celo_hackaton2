-- ============================================================
-- Earnings atomic increment function
-- Run this in Supabase SQL Editor ONCE before deploying
-- ============================================================

-- Atomically increments total_earned for a player.
-- Uses UPDATE directly — no read-then-write race condition.
CREATE OR REPLACE FUNCTION increment_total_earned(p_address TEXT, p_amount NUMERIC)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE players
  SET total_earned = total_earned + p_amount
  WHERE wallet_address = p_address;
$$;
