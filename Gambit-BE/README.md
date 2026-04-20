# Gambit Backend — FE Integration Guide

Backend for Chess MiniPay (Celo Sepolia). Handles game logic, matchmaking, move validation, clock management, and smart contract interaction with `MatchEscrow`.

**Base URL (dev):** `http://localhost:3001`  
**Swagger UI:** `http://localhost:3001/api-docs`  
**WebSocket:** `ws://localhost:3001?gameId=<uuid>&token=<jwt>`

---

## Table of Contents

1. [Setup & Run](#setup--run)
2. [Authentication Flow](#authentication-flow)
3. [PvP Game Flow](#pvp-game-flow)
4. [Bot Game Flow](#bot-game-flow)
5. [WebSocket — Events](#websocket--events)
6. [REST API Reference](#rest-api-reference)
7. [Puzzle Claim Flow](#puzzle-claim-flow)
8. [Smart Contract Integration](#smart-contract-integration)
9. [Error Codes](#error-codes)
10. [Data Types](#data-types)
11. [Changelog](#changelog)

---

## Setup & Run

```bash
npm install
cp .env.example .env   # fill in variables (see bottom of this file)
npm run dev            # development with hot reload
npm run build && npm start  # production
```

**Health check:**

```
GET /health
→ { "status": "ok", "timestamp": "..." }
```

---

## Authentication Flow

Wallet-based authentication. FE requests a nonce → user signs → BE issues a JWT.

### Step 1 — Request nonce

```
GET /auth/nonce?address=0x1234...
```

```json
{
  "nonce": "a3f9c2...",
  "expiresAt": "2026-04-19T16:00:00.000Z"
}
```

### Step 2 — Verify and get token

> In **development**: `txHash` is optional (skips on-chain verification).  
> In **production**: must send a micro-tx of 0.001 CELO to treasury with the nonce as memo.

```
POST /auth/verify
Content-Type: application/json

{
  "address": "0x1234...",
  "txHash": "0xabc..."   // optional in dev
}
```

```json
{
  "token": "eyJhbGci...",
  "expiresIn": 86400
}
```

### Using the token

Add this header to all authenticated requests:

```
Authorization: Bearer eyJhbGci...
```

Token is valid for **24 hours**.

---

## PvP Game Flow

Full sequence from game creation to payout:

```
FE Alice                     BE                      Smart Contract (MatchEscrow)
    │                         │                               │
    │── POST /game/create ───►│                               │
    │◄─ { gameId, depositTx } │                               │
    │                         │                               │
    │── createMatch(tc, value)────────────────────────────────►│
    │                         │◄── MatchCreated(matchId, A) ──│
    │                         │   (link matchId to gameId)    │
    │                         │                               │
FE Bob                        │                               │
    │── GET /game/lobby ──────►│                               │
    │◄─ [ waiting games ] ────│                               │
    │                         │                               │
    │── POST /game/join ──────►│                               │
    │◄─ { gameId, depositTx } │                               │
    │                         │                               │
    │── joinMatch(matchId, value)─────────────────────────────►│
    │                         │◄── MatchJoined(matchId, B) ───│
    │                         │   (status → active)           │
    │                         │                               │
    │   [GAME IN PROGRESS via WebSocket]                       │
    │                         │                               │
    │── WS: move:send ───────►│                               │
    │◄── WS: move:made ───────│                               │
    │   (both players)        │                               │
    │                         │                               │
    │   [GAME OVER]           │                               │
    │◄── WS: game:end ────────│                               │
    │                         │── settleMatch(id, winner, sig)►│
    │                         │                         pays out 97% to winner
```

### Step 1 — Create game

```
POST /game/create
Authorization: Bearer <token>

{
  "stake": "1.00",          // "0.50" | "1.00" | "2.00"
  "timeControl": "3+0",     // "1+0" | "3+0" | "3+2" | "5+0" | "5+3" | "10+0" | "10+5"
  "color": "random",        // "white" | "black" | "random"
  "mode": "pvp"             // "pvp" | "bot"
}
```

```json
{
  "gameId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "waiting",
  "depositTx": {
    "to": "0xF8CeF418419E8F1588d6EB26095358CFAF635dC5",
    "functionName": "createMatch",
    "args": [180],
    "value": "1000000000000000000"
  }
}
```

**FE must call the SC immediately after:**

```ts
// Example with viem
await walletClient.writeContract({
  address: depositTx.to,
  abi: MatchEscrowABI,
  functionName: "createMatch",
  args: [depositTx.args[0]], // timeControlSeconds
  value: BigInt(depositTx.value), // stakeWei
});
// SC emits MatchCreated → BE automatically links matchId to gameId
```

### Step 2 — Browse lobby (Bob)

```
GET /game/lobby?stake=1.00&timeControl=3%2B0
```

```json
{
  "games": [
    {
      "id": "550e8400-...",
      "white_address": "0xalice...",
      "black_address": null,
      "stake_amount": 1.0,
      "time_control": "3+0",
      "status": "waiting",
      "expires_at": "2026-04-19T16:05:00.000Z"
    }
  ]
}
```

### Step 3 — Join game

```
POST /game/join
Authorization: Bearer <token>

{
  "gameId": "550e8400-..."
}
```

```json
{
  "gameId": "550e8400-...",
  "white": "0xalice...",
  "black": "0xbob...",
  "stake": 1.0,
  "depositTx": {
    "to": "0xF8CeF418419E8F1588d6EB26095358CFAF635dC5",
    "functionName": "joinMatch",
    "args": ["7"],
    "value": "1000000000000000000"
  }
}
```

**FE must call the SC after:**

```ts
await walletClient.writeContract({
  address: depositTx.to,
  abi: MatchEscrowABI,
  functionName: "joinMatch",
  args: [BigInt(depositTx.args[0])], // matchId
  value: BigInt(depositTx.value),
});
// SC emits MatchJoined → BE sets game status → active
// FE can connect WebSocket after this
```

### Step 4 — Connect WebSocket

```
ws://localhost:3001?gameId=550e8400-...&token=eyJhbGci...
```

After connecting, you'll receive a confirmation:

```json
{ "event": "connected", "gameId": "550e8400-..." }
```

### Step 5 — Send a move

```json
// FE → BE (send via WS)
{
  "event": "move:send",
  "move": "e2e4"         // UCI format: "e2e4", "e1g1" (castling), "e7e8q" (promotion)
}

// BE → both FEs (broadcast)
{
  "event": "move:made",
  "gameId": "550e8400-...",
  "move": "e2e4",
  "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
  "whiteTimeMs": 179800,
  "blackTimeMs": 180000,
  "moveNumber": 1
}
```

### Step 6 — Game over

```json
// BE → both FEs (broadcast)
{
  "event": "game:end",
  "gameId": "550e8400-...",
  "result": "white_win", // "white_win" | "black_win" | "draw"
  "reason": "checkmate" // "checkmate" | "resignation" | "timeout" | "draw"
}
```

BE automatically calls `settleMatch` on-chain after this. Payout goes to the winner's wallet.

---

## Bot Game Flow

Simpler — no on-chain deposit, WebSocket is optional.

```
POST /game/create
{ "stake": "0.00", "mode": "bot", "color": "white" }
→ status is immediately "active", no depositTx
```

FE can use **REST** for bot games (WebSocket not required):

```
POST /game/:gameId/move  { "move": "e2e4" }
```

Response includes the bot's move:

```json
{
  "valid": true,
  "fen": "...", // position after bot's move
  "whiteTimeMs": 178000,
  "blackTimeMs": 179500,
  "moveNumber": 2,
  "gameOver": false,
  "isBotGame": true
}
```

---

## WebSocket — Events

### Connection URL

```
ws://<host>?gameId=<uuid>&token=<jwt>
```

JWT token **must be valid** — connection is rejected if token is expired or invalid.

### Events: FE → BE

| Event         | Payload            | Description                                                |
| ------------- | ------------------ | ---------------------------------------------------------- |
| `move:send`   | `{ move: "e2e4" }` | Send a UCI move                                            |
| `draw:offer`  | `{}`               | Offer a draw to opponent                                   |
| `draw:accept` | `{}`               | Accept opponent's draw offer — triggers full game end flow |
| `game:resign` | `{}`               | Resign from the game                                       |

### Events: BE → FE

| Event           | Payload                                               | Description                                                                                                                                          |
| --------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connected`     | `{ gameId }`                                          | Connection confirmed                                                                                                                                 |
| `move:made`     | `{ move, fen, whiteTimeMs, blackTimeMs, moveNumber }` | Valid move, broadcast to both players                                                                                                                |
| `move:invalid`  | `{ reason }`                                          | Move rejected (sender only)                                                                                                                          |
| `draw:offered`  | `{ by }`                                              | Draw offer notification (to opponent only)                                                                                                           |
| `draw:accepted` | `{ by }`                                              | Draw accepted, followed immediately by `game:end`                                                                                                    |
| `game:end`      | `{ gameId, result, reason }`                          | Game is over — `result`: `"white_win"` \| `"black_win"` \| `"draw"`, `reason`: `"checkmate"` \| `"resignation"` \| `"timeout"` \| `"draw_agreement"` |
| `error`         | `{ message }`                                         | General error (sender only)                                                                                                                          |

> **`draw:accept` is fully implemented.** When a player sends `draw:accept`, BE:
>
> 1. Sets `games.status = "completed"`, `result = "draw"`, `end_reason = "draw_agreement"`
> 2. Updates ELO ratings for both players
> 3. Calls `PuzzlePool.settleMatch(matchId, address(0))` on-chain (if matchId is set)
> 4. Broadcasts `draw:accepted` then `game:end` to both players

### WebSocket implementation example (React)

```ts
const ws = useRef<WebSocket | null>(null);

function connectGame(gameId: string, token: string) {
  ws.current = new WebSocket(`ws://localhost:3001?gameId=${gameId}&token=${token}`);

  ws.current.onmessage = (e) => {
    const msg = JSON.parse(e.data);

    switch (msg.event) {
      case "connected":
        console.log("Connected to game", msg.gameId);
        break;
      case "move:made":
        updateBoard(msg.fen);
        updateClocks(msg.whiteTimeMs, msg.blackTimeMs);
        break;
      case "game:end":
        showResult(msg.result, msg.reason);
        break;
    }
  };
}

function sendMove(uciMove: string) {
  ws.current?.send(
    JSON.stringify({
      event: "move:send",
      move: uciMove,
    }),
  );
}
```

---

## REST API Reference

### Auth

#### `GET /auth/nonce`

Request a nonce before logging in.

| Param     | Type         | Required | Description            |
| --------- | ------------ | -------- | ---------------------- |
| `address` | query string | ✅       | Wallet address `0x...` |

**Response 200:**

```json
{ "nonce": "a3f9c2...", "expiresAt": "2026-04-19T16:00:00.000Z" }
```

---

#### `POST /auth/verify`

Verify wallet ownership and receive a JWT.

**Body:**

```json
{ "address": "0x...", "txHash": "0x..." }
```

**Response 200:**

```json
{ "token": "eyJ...", "expiresIn": 86400 }
```

---

### Game

#### `POST /game/create` 🔐

Create a new game.

**Body:**
| Field | Type | Default | Valid values |
|-------|------|---------|-------------|
| `stake` | string | — | `"0.50"` `"1.00"` `"2.00"` |
| `timeControl` | string | `"3+0"` | `"1+0"` `"3+0"` `"3+2"` `"5+0"` `"5+3"` `"10+0"` `"10+5"` |
| `color` | string | `"random"` | `"white"` `"black"` `"random"` |
| `mode` | string | `"pvp"` | `"pvp"` `"bot"` |

**Response 201:**

```json
{
  "gameId": "uuid",
  "status": "waiting",
  "depositTx": {
    "to": "0xF8CeF4...",
    "functionName": "createMatch",
    "args": [180],
    "value": "1000000000000000000"
  }
}
```

> `depositTx.value` is in wei (1 CELO = `1000000000000000000`).  
> Bot games do not return `depositTx`.

---

#### `POST /game/join` 🔐

Join a waiting game.

**Body:**

```json
{ "gameId": "uuid" }
```

**Response 200:**

```json
{
  "gameId": "uuid",
  "white": "0xalice...",
  "black": "0xbob...",
  "stake": 1.0,
  "depositTx": {
    "to": "0xF8CeF4...",
    "functionName": "joinMatch",
    "args": ["7"],
    "value": "1000000000000000000"
  }
}
```

---

#### `GET /game/lobby`

List of games waiting for a second player.

| Param         | Type         | Required | Description                 |
| ------------- | ------------ | -------- | --------------------------- |
| `stake`       | query number | ❌       | Filter: `0.5`, `1.0`, `2.0` |
| `timeControl` | query string | ❌       | Filter: `"3+0"` etc.        |

**Response 200:**

```json
{
  "games": [
    {
      "id": "uuid",
      "white_address": "0x...",
      "black_address": null,
      "stake_amount": 1.0,
      "time_control": "3+0",
      "status": "waiting",
      "expires_at": "2026-04-19T16:05:00.000Z",
      "created_at": "2026-04-19T16:00:00.000Z"
    }
  ]
}
```

---

#### `GET /game/:gameId`

Get full game state including move history.

**Response 200:**

```json
{
  "id": "uuid",
  "white_address": "0xalice...",
  "black_address": "0xbob...",
  "status": "active",
  "result": null,
  "mode": "pvp",
  "stake_amount": 1.0,
  "time_control": "3+0",
  "fen": "rnbqkbnr/.../...",
  "white_time_ms": 179800,
  "black_time_ms": 178500,
  "move_count": 4,
  "winner_address": null,
  "end_reason": null,
  "onchain_game_id": "7",
  "moves": [
    {
      "move_number": 1,
      "uci_move": "e2e4",
      "fen_after": "...",
      "player_address": "0xalice...",
      "time_remaining_ms": 179800
    }
  ]
}
```

---

#### `POST /game/:gameId/move` 🔐

Submit a move (REST alternative to WS, useful for bot games).

**Body:**

```json
{ "move": "e2e4" }
```

UCI format: `"e2e4"` (pawn), `"e1g1"` (kingside castling), `"e7e8q"` (promotion to queen).

**Response 200:**

```json
{
  "valid": true,
  "fen": "rnbqkbnr/.../...",
  "whiteTimeMs": 179800,
  "blackTimeMs": 180000,
  "moveNumber": 1,
  "gameOver": false,
  "isBotGame": false
}
```

**Response 422 (invalid move):**

```json
{
  "code": "INVALID_MOVE",
  "status": 422,
  "message": "Invalid move",
  "reason": "Not your turn"
}
```

---

#### `POST /game/:gameId/resign` 🔐

Resign from the game.

**Response 200:**

```json
{
  "result": "black_win",
  "payoutTxHash": "0xabc..."
}
```

---

### Puzzle

#### `GET /puzzle/daily`

Today's daily puzzle. **Solution is not returned.**

**Response 200:**

```json
{
  "id": "puzzle-2026-04-19",
  "fen": "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq",
  "to_move": "white",
  "prize_pool": 5.0,
  "participants": 42,
  "puzzle_date": "2026-04-19",
  "expires_at": "2026-04-19T23:59:59.999Z"
}
```

---

#### `POST /puzzle/daily/submit` 🔐

Submit puzzle answer.

**Body:**

```json
{
  "puzzleId": "puzzle-2026-04-19",
  "moves": ["h5f7"],
  "timeMs": 4200
}
```

`moves` is an array of UCI moves — for a 1-move puzzle, just one element.

**Response 200:**

```json
{
  "correct": true,
  "rank": 3,
  "totalParticipants": 43,
  "reward": 0
}
```

> `reward` is `0` until the round is finalized at midnight UTC. After finalization it reflects the CELO share.

---

#### `GET /puzzle/daily/proof?addr=<address>`

Get the Merkle proof needed to call `PuzzlePool.claim()` on-chain.

| Param  | Type  | Required | Description           |
| ------ | ----- | -------- | --------------------- |
| `addr` | query | ✅       | Player wallet address |

**Response 200** (round finalized, address is a winner):

```json
{
  "amount": "2500000000000000000",
  "proof": ["0xabc123...", "0xdef456..."]
}
```

- `amount` — prize in wei (`uint256`), pass directly to `PuzzlePool.claim`
- `proof` — `bytes32[]` Merkle proof array

**Response 404** — round not yet finalized or address is not in top-10:

```json
{ "error": "Not a winner or round not yet finalized" }
```

> Round is finalized automatically by cron at **00:00 UTC** (next day). Top-10 fastest correct solvers split the prize pool equally.

**Using the proof on-chain:**

```ts
const res = await fetch(`${API_URL}/puzzle/daily/proof?addr=${address}`);
const { amount, proof } = await res.json();

await writeContract({
  address: CONTRACTS.puzzlePool,
  abi: puzzlePoolAbi,
  functionName: "claim",
  args: [today, BigInt(amount), proof], // today from useTodayIndex()
});
```

---

#### `GET /puzzle/:day/proof?address=<address>`

Same as above but for a specific past day (`YYYY-MM-DD`). Useful for claiming prizes from previous rounds.

```
GET /puzzle/2026-04-19/proof?address=0xabc...
```

Response shape identical to `/puzzle/daily/proof`.

---

### Player

#### `GET /player/:address`

Get stats for any player by wallet address — works regardless of leaderboard rank.

| Param     | Type | Required | Description                               |
| --------- | ---- | -------- | ----------------------------------------- |
| `address` | path | ✅       | Wallet address `0x...` (case-insensitive) |

**Response 200:**

```json
{
  "wallet_address": "0xabc...",
  "username": "alice",
  "rating": 1450,
  "wins": 12,
  "losses": 4,
  "draws": 1,
  "total_earned": 11.64,
  "rank": 7,
  "created_at": "2026-01-01T00:00:00Z",
  "last_seen": "2026-04-20T08:30:00Z"
}
```

- `rank` — global position by rating (1 = highest). Always present for any player.
- `username` — `null` if not set.
- `total_earned` — in CELO.

**Response 404:** player not found (address has never played).

> **FE note:** replaces the leaderboard-scan pattern in `hooks/use-player-stats.ts`. Use this endpoint instead of scanning top-100 leaderboard — users outside top-100 will now have correct stats.

---

#### `GET /player/:address/games`

Match history for a player.

| Param     | Type  | Default | Description                                                  |
| --------- | ----- | ------- | ------------------------------------------------------------ |
| `address` | path  | —       | Wallet address                                               |
| `limit`   | query | `20`    | Max `100`                                                    |
| `offset`  | query | `0`     | Pagination offset                                            |
| `status`  | query | —       | Filter: `waiting` `active` `completed` `cancelled` `expired` |

**Response 200:**

```json
{
  "games": [
    {
      "id": "uuid",
      "white_address": "0xalice...",
      "black_address": "0xbob...",
      "status": "completed",
      "result": "white_win",
      "mode": "pvp",
      "stake_amount": 1.0,
      "time_control": "3+0",
      "move_count": 34,
      "winner_address": "0xalice...",
      "end_reason": "checkmate",
      "opponent": "0xbob...",
      "playerColor": "white",
      "started_at": "2026-04-20T10:00:00Z",
      "ended_at": "2026-04-20T10:15:00Z",
      "created_at": "2026-04-20T09:59:00Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

`opponent` and `playerColor` are convenience fields added by BE — no need to compute from white/black addresses on FE.

---

#### `GET /player/:address/transactions`

Transaction history for a player (deposits, payouts, refunds).

| Param     | Type  | Default | Description       |
| --------- | ----- | ------- | ----------------- |
| `address` | path  | —       | Wallet address    |
| `limit`   | query | `20`    | Max `100`         |
| `offset`  | query | `0`     | Pagination offset |

**Response 200:**

```json
{
  "transactions": [
    {
      "id": "uuid",
      "game_id": "uuid",
      "tx_type": "payout",
      "tx_hash": "0xdeadbeef...",
      "amount": "1.940000",
      "status": "confirmed",
      "created_at": "2026-04-20T10:15:05Z",
      "confirmed_at": "2026-04-20T10:15:10Z"
    }
  ],
  "limit": 20,
  "offset": 0
}
```

`tx_type`: `deposit` | `payout` | `refund` | `fee`

---

#### `GET /player/online`

Current number of active WebSocket connections (proxy for online players).

**Response 200:**

```json
{ "online": 14 }
```

---

### Leaderboard

#### `GET /leaderboard`

| Param    | Type         | Default | Description                    |
| -------- | ------------ | ------- | ------------------------------ |
| `period` | query string | `"all"` | `"weekly"` `"monthly"` `"all"` |
| `limit`  | query number | `20`    | Max `100`                      |

**Response 200:**

```json
{
  "period": "all",
  "entries": [
    {
      "rank": 1,
      "address": "0x...",
      "username": "ChessMaster",
      "wins": 42,
      "losses": 8,
      "draws": 3,
      "rating": 1487,
      "totalEarned": 38.75
    }
  ]
}
```

---

## Smart Contract Integration

### Contract Addresses (Celo Sepolia — Chain 11142220)

| Contract     | Address                                      |
| ------------ | -------------------------------------------- |
| MatchEscrow  | `0xF8CeF418419E8F1588d6EB26095358CFAF635dC5` |
| GambitHub    | `0xA68141b7b36d1161757e1790BcB5199d4EfFF281` |
| PuzzlePool   | `0xbE34567ADF30c233103AEbFBB2b940e06DAc7366` |
| ClubVault    | `0x3665188aB87951Bb42984cFECC14bF5925C21644` |
| GambitBadges | `0xB31A2CAB3e267528815067cD6F7d6D7957f9FfB9` |

### Minimal ABI for FE

FE only needs 2 functions from MatchEscrow:

```ts
const MATCH_ESCROW_ABI = [
  {
    name: "createMatch",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "timeControl", type: "uint256" }],
    outputs: [{ name: "matchId", type: "uint256" }],
  },
  {
    name: "joinMatch",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "matchId", type: "uint256" }],
    outputs: [],
  },
] as const;
```

### Stake Conversion

| Stake (CELO) | Wei                   |
| ------------ | --------------------- |
| 0.50         | `500000000000000000`  |
| 1.00         | `1000000000000000000` |
| 2.00         | `2000000000000000000` |

```ts
// Convert stake string to wei
const stakeWei = parseEther(stake); // viem parseEther("1.00") → 1000000000000000000n
```

### Time Control → Seconds

| Time Control | Seconds                       |
| ------------ | ----------------------------- |
| `"1+0"`      | 60                            |
| `"3+0"`      | 180                           |
| `"3+2"`      | 180 (increment handled by BE) |
| `"5+0"`      | 300                           |
| `"10+0"`     | 600                           |

### Full Integration Example (viem + React)

```ts
import { parseEther } from "viem";

// 1. Create game on BE
const { gameId, depositTx } = await fetch("/game/create", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({ stake: "1.00", timeControl: "3+0", mode: "pvp" }),
}).then((r) => r.json());

// 2. Deposit stake to SC
const txHash = await walletClient.writeContract({
  address: depositTx.to,
  abi: MATCH_ESCROW_ABI,
  functionName: "createMatch",
  args: [BigInt(depositTx.args[0])],
  value: BigInt(depositTx.value), // parseEther("1.00")
});

// 3. Wait for confirmation (BE event watcher will automatically link matchId)
await publicClient.waitForTransactionReceipt({ hash: txHash });

// 4. Connect WebSocket
const ws = new WebSocket(`ws://localhost:3001?gameId=${gameId}&token=${token}`);
```

---

## Error Codes

| Code                       | HTTP | Description                              |
| -------------------------- | ---- | ---------------------------------------- |
| `AUTH_REQUIRED`            | 401  | `Authorization` header missing           |
| `AUTH_INVALID`             | 403  | Token expired or invalid                 |
| `GAME_NOT_FOUND`           | 404  | Game not found                           |
| `GAME_FULL`                | 409  | Game already full or already joined      |
| `GAME_EXPIRED`             | 410  | Waiting game expired (>5 minutes)        |
| `GAME_ALREADY_ENDED`       | 409  | Game has already ended                   |
| `INVALID_MOVE`             | 422  | Move is not valid chess                  |
| `NOT_YOUR_TURN`            | 422  | Not this player's turn                   |
| `STAKE_NOT_DEPOSITED`      | 402  | Stake has not been deposited to contract |
| `PUZZLE_EXPIRED`           | 410  | Today's puzzle has expired               |
| `PUZZLE_ALREADY_SUBMITTED` | 409  | Already submitted this puzzle            |
| `RATE_LIMIT`               | 429  | Too many requests (max 100/min)          |
| `SERVER_ERROR`             | 500  | Internal server error                    |

**Error response format:**

```json
{
  "code": "GAME_NOT_FOUND",
  "status": 404,
  "message": "Game not found"
}
```

---

## Data Types

### Game Object

```ts
type GameStatus = "waiting" | "active" | "completed" | "cancelled" | "expired";
type GameResult = "white_win" | "black_win" | "draw" | "abort";

interface Game {
  id: string; // UUID
  onchain_game_id: string | null; // uint256 matchId from SC (decimal string)
  white_address: string | null;
  black_address: string | null;
  status: GameStatus;
  result: GameResult | null;
  mode: "pvp" | "bot";
  stake_amount: number; // CELO (not wei)
  time_control: string; // "3+0"
  fen: string; // current board position
  white_time_ms: number | null; // white's remaining time
  black_time_ms: number | null; // black's remaining time
  move_count: number;
  winner_address: string | null;
  end_reason: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  expires_at: string | null;
}
```

### Move Object

```ts
interface Move {
  id: string;
  game_id: string;
  player_address: string;
  move_number: number;
  uci_move: string; // "e2e4"
  fen_after: string;
  time_remaining_ms: number | null;
  created_at: string;
}
```

### Player Object

```ts
interface Player {
  wallet_address: string; // lowercase, primary key
  username: string | null;
  rating: number; // ELO (default 1200)
  wins: number;
  losses: number;
  draws: number;
  total_earned: number; // total CELO earned
  rank: number; // global position by rating (GET /player/:address only)
  created_at: string;
  last_seen: string;
}
```

---

## Important Notes for FE

1. **Required order for PvP game creation:** `POST /game/create` → call SC `createMatch` → connect WebSocket. Do not connect WebSocket before depositing.

2. **`onchain_game_id` can be null** — it is populated automatically after the SC emits `MatchCreated`. Do not use this field for `joinMatch`; use `depositTx.args[0]` from the join response instead.

3. **Stake is in CELO, not cUSD.** The SC uses native CELO (`msg.value`), not an ERC-20 token.

4. **Move format is UCI:** column + row, e.g. `e2e4`. Castling: `e1g1` (white kingside), `e1c1` (white queenside). Promotion: `e7e8q` (append piece letter: `q`/`r`/`b`/`n`).

5. **Bot games:** no deposit required, WebSocket is optional (REST works), `stake_amount` must be `0`.

6. **JWT token expires in 24 hours** — refresh by calling `GET /auth/nonce` + `POST /auth/verify` again.

7. **WS heartbeat** every 30 seconds (server sends ping) — browser WebSocket handles `pong` automatically.

8. **Player stats:** use `GET /player/:address` directly — do not scan the leaderboard to find a user's own stats. The leaderboard only returns the top N entries.

9. **Puzzle proof:** call `GET /puzzle/daily/proof?addr=<address>` after `distributed === true` (from `useRound(today)`). Returns 404 until midnight UTC when the round is finalized.
