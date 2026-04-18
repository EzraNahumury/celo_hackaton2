# Chess MiniPay — Interface Contract

> Dokumen ini adalah **single source of truth** untuk komunikasi antar role.
> Semua orang (FE, BE, SC) wajib baca dan sepakat sebelum mulai coding.
>
> Last updated: 17 April 2026

---

## Daftar Isi

1. [Arsitektur Overview](#1-arsitektur-overview)
2. [Shared Types & Enums](#2-shared-types--enums)
3. [Smart Contract Interface (SC → FE & BE)](#3-smart-contract-interface)
4. [Backend REST API (BE → FE)](#4-backend-rest-api)
5. [WebSocket Events (BE ↔ FE)](#5-websocket-events)
6. [Data Flow per Fitur](#6-data-flow-per-fitur)
7. [Error Codes](#7-error-codes)
8. [Environment & Config](#8-environment--config)
9. [Checklist Sync Points](#9-checklist-sync-points)

---

## 1. Arsitektur Overview

```
┌─────────────────────────────────────────────────┐
│                   FRONTEND (FE)                 │
│  Next.js 14 + Tailwind + wagmi + chess.js       │
│  MiniPay hook (window.ethereum)                 │
└────────┬────────────────────┬───────────────────┘
         │ REST API           │ WebSocket
         │ (game mgmt)        │ (realtime moves)
         ▼                    ▼
┌─────────────────────────────────────────────────┐
│                   BACKEND (BE)                  │
│  Node.js + Supabase + chess.js (validation)     │
│  Stockfish WASM (bot mode)                      │
└────────┬────────────────────────────────────────┘
         │ ethers.js / viem
         │ (trigger contract calls from server)
         ▼
┌─────────────────────────────────────────────────┐
│              SMART CONTRACT (SC)                │
│  Solidity on Celo Mainnet                       │
│  ChessEscrow.sol + ChessPuzzle.sol              │
└─────────────────────────────────────────────────┘
```

**Prinsip: Game logic di server, uang di blockchain.**

- FE TIDAK pernah langsung panggil smart contract untuk game logic
- FE hanya panggil smart contract untuk: deposit stake dan approve cUSD
- BE yang trigger: match resolution, payout, refund
- SC hanya pegang uang dan payout rules — tidak tahu apa-apa tentang catur

---

## 2. Shared Types & Enums

Semua role harus pakai definisi yang sama. Copy paste ke masing-masing codebase.

### 2.1 Game Status

```typescript
enum GameStatus {
  WAITING    = "waiting",    // menunggu lawan
  ACTIVE     = "active",     // sedang bermain
  COMPLETED  = "completed",  // selesai (ada pemenang/draw)
  CANCELLED  = "cancelled",  // dibatalkan (timeout, disconnect)
  EXPIRED    = "expired"     // tidak ada lawan dalam 5 menit
}
```

### 2.2 Game Result

```typescript
enum GameResult {
  WHITE_WIN  = "white_win",
  BLACK_WIN  = "black_win",
  DRAW       = "draw",
  ABORT      = "abort"       // game dibatalkan sebelum move ke-2
}
```

### 2.3 Stake Amount

```typescript
// Hanya 3 pilihan, dalam cUSD (6 decimals onchain)
enum StakeAmount {
  SMALL  = "0.50",   // 500000 wei
  MEDIUM = "1.00",   // 1000000 wei
  LARGE  = "2.00"    // 2000000 wei
}
```

### 2.4 Time Control

```typescript
// Format: minutes + increment in seconds
enum TimeControl {
  BULLET_1_0  = "1+0",    // 1 menit, tanpa increment
  BLITZ_3_0   = "3+0",    // 3 menit
  BLITZ_3_2   = "3+2",    // 3 menit + 2 detik increment
  RAPID_5_3   = "5+3",    // 5 menit + 3 detik increment
}
```

### 2.5 Common Data Shapes

```typescript
// Wallet address — selalu lowercase, 0x-prefixed
type WalletAddress = `0x${string}`;  // contoh: "0x1234...abcd"

// Move format — UCI notation
type UCIMove = string;  // contoh: "e2e4", "e7e5", "e1g1" (castling)

// Game ID — UUID v4 dari backend
type GameId = string;  // contoh: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

// Onchain Game ID — uint256 dari smart contract
type OnchainGameId = bigint;  // contoh: 1n, 2n, 3n

// FEN — board position string
type FEN = string;  // contoh: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"

// Timestamp — ISO 8601
type Timestamp = string;  // contoh: "2026-04-17T10:30:00Z"
```

---

## 3. Smart Contract Interface

**File:** `ChessEscrow.sol`
**Network:** Celo Mainnet (chain ID 42220)
**cUSD Address:** `0x765DE816845861e75A25fCA122bb6898B8B1282a`

### 3.1 Contract Functions

SC harus expose function-function ini. BE dan FE butuh ABI-nya.

```solidity
// ============================================
// PLAYER CALLS (FE panggil langsung via MiniPay)
// ============================================

/// @notice Player deposit stake untuk game baru atau join game
/// @dev Player harus approve cUSD dulu sebelum panggil ini
/// @param gameId ID game dari backend (bytes32)
/// @param amount Stake amount dalam wei (500000, 1000000, atau 2000000)
function depositStake(bytes32 gameId, uint256 amount) external;

/// @notice Cek berapa saldo stake player di game tertentu
function getStake(bytes32 gameId, address player) external view returns (uint256);


// ============================================
// SERVER CALLS (hanya BE yang boleh panggil)
// ============================================

/// @notice Resolve game — transfer stake ke winner
/// @dev Hanya bisa dipanggil oleh SERVER_ROLE
/// @param gameId ID game
/// @param winner Address pemenang (address(0) kalau draw)
/// @param player1 Address player 1
/// @param player2 Address player 2
function resolveGame(
    bytes32 gameId,
    address winner,
    address player1,
    address player2
) external onlyRole(SERVER_ROLE);

/// @notice Refund stake kalau game expired/cancelled
/// @dev Hanya bisa dipanggil oleh SERVER_ROLE
function refundStake(bytes32 gameId, address player) external onlyRole(SERVER_ROLE);


// ============================================
// VIEW FUNCTIONS (siapa saja boleh panggil)
// ============================================

/// @notice Cek status game onchain
function getGameState(bytes32 gameId) external view returns (
    address player1,
    address player2,
    uint256 totalStake,
    bool resolved
);
```

### 3.2 Events

SC harus emit events ini. FE dan BE listen untuk UI update.

```solidity
event StakeDeposited(
    bytes32 indexed gameId,
    address indexed player,
    uint256 amount
);

event GameResolved(
    bytes32 indexed gameId,
    address indexed winner,    // address(0) kalau draw
    uint256 winnerPayout,
    uint256 loserPayout        // 0 kalau bukan draw
);

event StakeRefunded(
    bytes32 indexed gameId,
    address indexed player,
    uint256 amount
);
```

### 3.3 Fee Structure

```
Winner gets: 95% of total pot (both stakes)
Platform fee: 5% of total pot → treasury address
Draw: masing-masing dapat 97.5% of own stake (2.5% fee)
Abort (< 2 moves): full refund, no fee
```

### 3.4 Yang SC Harus Deliver ke FE & BE

| Deliverable | Format | Deadline |
|-------------|--------|----------|
| ABI file | `ChessEscrow.json` | Akhir Hari 2 |
| Contract address (testnet) | `0x...` di shared doc | Akhir Hari 2 |
| Contract address (mainnet) | `0x...` di shared doc | Akhir Hari 6 |
| Verified source code | Celoscan link | Akhir Hari 6 |

---

## 4. Backend REST API

**Base URL:** `https://api.chessminipay.xyz` (production) / `http://localhost:3001` (dev)

### 4.1 Auth

Semua request harus include header:

```
Authorization: Bearer <wallet_address>
```

BE verifikasi ownership wallet via signed message saat pertama kali connect.
(Note: MiniPay belum support message signing — gunakan nonce-based auth sebagai workaround.)

**Workaround auth flow:**
1. FE request nonce: `GET /auth/nonce?address=0x...`
2. BE return nonce
3. FE kirim micro-tx (0.001 cUSD) ke BE treasury dengan nonce di memo
4. BE verifikasi tx onchain → issue JWT
5. Semua subsequent request pakai JWT

### 4.2 Endpoints

#### `POST /game/create`

Player buat game baru dan tunggu lawan.

**Request:**
```json
{
  "stake": "0.50",           // StakeAmount enum
  "timeControl": "3+0",     // TimeControl enum
  "color": "random"         // "white" | "black" | "random"
}
```

**Response (201):**
```json
{
  "gameId": "a1b2c3d4-...",
  "onchainGameId": "0x...",  // bytes32 untuk depositStake()
  "status": "waiting",
  "stake": "0.50",
  "timeControl": "3+0",
  "createdAt": "2026-04-17T10:30:00Z",
  "expiresAt": "2026-04-17T10:35:00Z",   // 5 menit timeout
  "depositTx": {
    "to": "0x...",            // ChessEscrow contract address
    "functionName": "depositStake",
    "args": ["0x...", "500000"]
  }
}
```

FE langsung panggil `depositStake()` ke smart contract setelah dapat response ini.

---

#### `POST /game/join`

Player join game yang sudah ada.

**Request:**
```json
{
  "gameId": "a1b2c3d4-..."
}
```

**Response (200):**
```json
{
  "gameId": "a1b2c3d4-...",
  "onchainGameId": "0x...",
  "status": "active",
  "white": "0x1234...abcd",
  "black": "0x5678...efgh",
  "stake": "0.50",
  "timeControl": "3+0",
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "depositTx": {
    "to": "0x...",
    "functionName": "depositStake",
    "args": ["0x...", "500000"]
  }
}
```

---

#### `GET /game/:gameId`

Ambil state game saat ini.

**Response (200):**
```json
{
  "gameId": "a1b2c3d4-...",
  "status": "active",
  "white": "0x1234...abcd",
  "black": "0x5678...efgh",
  "stake": "0.50",
  "timeControl": "3+0",
  "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
  "moves": ["e2e4"],
  "whiteTimeMs": 178500,
  "blackTimeMs": 180000,
  "lastMoveAt": "2026-04-17T10:30:15Z",
  "result": null
}
```

---

#### `GET /game/lobby`

List game yang menunggu lawan (untuk matchmaking).

**Query params:** `?stake=0.50&timeControl=3+0`

**Response (200):**
```json
{
  "games": [
    {
      "gameId": "a1b2c3d4-...",
      "creator": "0x1234...abcd",
      "stake": "0.50",
      "timeControl": "3+0",
      "createdAt": "2026-04-17T10:30:00Z"
    }
  ]
}
```

---

#### `POST /game/:gameId/move`

Kirim move. **Ini fallback kalau WebSocket mati** — normalnya move dikirim via WS.

**Request:**
```json
{
  "move": "e2e4"   // UCI notation
}
```

**Response (200):**
```json
{
  "valid": true,
  "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
  "whiteTimeMs": 178500,
  "blackTimeMs": 180000,
  "gameOver": false,
  "result": null
}
```

---

#### `POST /game/:gameId/resign`

Player menyerah.

**Response (200):**
```json
{
  "result": "black_win",
  "payoutTxHash": "0x..."
}
```

---

#### `GET /leaderboard`

**Query params:** `?period=weekly&limit=20`

**Response (200):**
```json
{
  "period": "weekly",
  "entries": [
    {
      "rank": 1,
      "address": "0x1234...abcd",
      "wins": 15,
      "losses": 3,
      "draws": 2,
      "totalEarned": "12.50",
      "rating": 1450
    }
  ]
}
```

---

#### `GET /puzzle/daily`

Puzzle harian (gratis).

**Response (200):**
```json
{
  "puzzleId": "puzzle-2026-04-17",
  "fen": "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
  "toMove": "white",
  "solution": null,
  "prizePool": "5.00",
  "participants": 42,
  "expiresAt": "2026-04-18T00:00:00Z"
}
```

---

#### `POST /puzzle/daily/submit`

Submit solusi puzzle.

**Request:**
```json
{
  "puzzleId": "puzzle-2026-04-17",
  "moves": ["h5f7"],
  "timeMs": 4200
}
```

**Response (200):**
```json
{
  "correct": true,
  "rank": 3,
  "totalParticipants": 43,
  "reward": "0.50"
}
```

---

## 5. WebSocket Events

**URL:** `wss://api.chessminipay.xyz/ws?gameId=xxx&token=xxx`

Pakai Supabase Realtime atau raw WebSocket. Format message: JSON.

### 5.1 Client → Server (FE kirim)

```typescript
// Join game room
{ "event": "game:join", "gameId": "a1b2c3d4-..." }

// Send move
{ "event": "move:send", "gameId": "a1b2c3d4-...", "move": "e2e4" }

// Offer draw
{ "event": "draw:offer", "gameId": "a1b2c3d4-..." }

// Accept draw
{ "event": "draw:accept", "gameId": "a1b2c3d4-..." }

// Decline draw
{ "event": "draw:decline", "gameId": "a1b2c3d4-..." }

// Resign
{ "event": "game:resign", "gameId": "a1b2c3d4-..." }
```

### 5.2 Server → Client (BE kirim)

```typescript
// Game started (opponent joined)
{
  "event": "game:start",
  "gameId": "a1b2c3d4-...",
  "white": "0x1234...abcd",
  "black": "0x5678...efgh",
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
}

// Move received (broadcast ke kedua player)
{
  "event": "move:made",
  "gameId": "a1b2c3d4-...",
  "move": "e2e4",
  "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
  "whiteTimeMs": 178500,
  "blackTimeMs": 180000,
  "moveNumber": 1
}

// Invalid move (hanya ke pengirim)
{
  "event": "move:invalid",
  "reason": "Illegal move: king in check"
}

// Game over
{
  "event": "game:end",
  "gameId": "a1b2c3d4-...",
  "result": "white_win",
  "reason": "checkmate",          // "checkmate" | "timeout" | "resignation" | "draw_agreement" | "stalemate" | "insufficient" | "threefold" | "fifty_moves"
  "payoutTxHash": "0xabc...",     // tx hash untuk verify di Celoscan
  "winnerPayout": "0.95",
  "loserPayout": "0.00"
}

// Draw offered (ke lawan)
{
  "event": "draw:offered",
  "gameId": "a1b2c3d4-...",
  "by": "0x1234...abcd"
}

// Opponent disconnected
{
  "event": "opponent:disconnected",
  "gameId": "a1b2c3d4-...",
  "timeoutAt": "2026-04-17T10:35:00Z"   // auto-forfeit setelah 60 detik
}

// Clock sync (setiap 10 detik)
{
  "event": "clock:sync",
  "whiteTimeMs": 170000,
  "blackTimeMs": 175000
}
```

---

## 6. Data Flow per Fitur

### 6.1 Flow: Create & Play Game (1v1 Stake)

```
Langkah 1 — Player A buat game:
  FE: POST /game/create { stake: "1.00", timeControl: "3+0" }
  BE: buat record di DB, return gameId + onchainGameId

Langkah 2 — Player A deposit stake:
  FE: approve cUSD → panggil depositStake(onchainGameId, 1000000)
  SC: emit StakeDeposited
  FE: confirm deposit → tampilkan "Waiting for opponent..."

Langkah 3 — Player B lihat lobby & join:
  FE: GET /game/lobby → lihat game Player A
  FE: POST /game/join { gameId }
  FE: approve cUSD → panggil depositStake(onchainGameId, 1000000)
  SC: emit StakeDeposited

Langkah 4 — BE deteksi kedua deposit masuk:
  BE: listen StakeDeposited event
  BE: kalau 2 deposit sudah masuk → update status "active"
  BE: emit WS "game:start" ke kedua player

Langkah 5 — Main catur:
  FE: kirim move via WS "move:send"
  BE: validasi dengan chess.js → broadcast "move:made"
  (repeat sampai game selesai)

Langkah 6 — Game selesai:
  BE: deteksi checkmate/timeout/resign/draw
  BE: panggil resolveGame() di smart contract
  SC: transfer cUSD ke winner, emit GameResolved
  BE: emit WS "game:end" dengan payoutTxHash
  FE: tampilkan result screen + link Celoscan
```

### 6.2 Flow: Daily Puzzle

```
Langkah 1 — BE generate puzzle (via cron, jam 00:00 UTC):
  BE: pilih puzzle dari database / lichess puzzle API
  BE: simpan di DB dengan prize pool

Langkah 2 — Player buka puzzle:
  FE: GET /puzzle/daily
  FE: render board dari FEN

Langkah 3 — Player submit solusi:
  FE: POST /puzzle/daily/submit { moves, timeMs }
  BE: validasi moves → update leaderboard
  BE: kalau benar, record solve time untuk ranking

Langkah 4 — Prize distribution (jam 23:59 UTC):
  BE: ranking by solve time → top 10 share prize pool
  BE: panggil smart contract untuk distribute
  SC: transfer cUSD ke winners
```

### 6.3 Flow: Play vs Bot (Stockfish)

```
Langkah 1 — Player pilih "Play vs Bot":
  FE: POST /game/create { stake: "0.50", mode: "bot", difficulty: 3 }
  FE: deposit stake ke contract

Langkah 2 — Game langsung mulai (no waiting):
  BE: assign bot sebagai opponent
  BE: emit WS "game:start" (bot address = server treasury)

Langkah 3 — Main:
  FE: kirim move via WS
  BE: validasi → feed ke Stockfish WASM → return bot move
  BE: broadcast "move:made" (bot response delay: 1-3 detik)

Langkah 4 — Selesai:
  (sama seperti 1v1 — resolve onchain)
```

---

## 7. Error Codes

Semua REST endpoint return error dalam format:

```json
{
  "error": {
    "code": "GAME_NOT_FOUND",
    "message": "Game with ID a1b2c3d4-... not found"
  }
}
```

| Code | HTTP | Artinya |
|------|------|---------|
| `AUTH_REQUIRED` | 401 | Tidak ada token / token expired |
| `AUTH_INVALID` | 403 | Wallet address tidak match |
| `GAME_NOT_FOUND` | 404 | Game ID tidak ada |
| `GAME_FULL` | 409 | Game sudah ada 2 player |
| `GAME_EXPIRED` | 410 | Game timeout (5 menit tanpa lawan) |
| `STAKE_NOT_DEPOSITED` | 402 | Player belum deposit stake |
| `INVALID_MOVE` | 422 | Move tidak valid (bukan giliran, illegal) |
| `NOT_YOUR_TURN` | 422 | Bukan giliran player ini |
| `GAME_ALREADY_ENDED` | 409 | Game sudah selesai |
| `PUZZLE_EXPIRED` | 410 | Daily puzzle sudah lewat |
| `PUZZLE_ALREADY_SUBMITTED` | 409 | Sudah pernah submit puzzle ini |
| `RATE_LIMIT` | 429 | Terlalu banyak request |
| `SERVER_ERROR` | 500 | Internal error |

---

## 8. Environment & Config

### 8.1 Shared Config (semua role butuh)

```env
# Network
CELO_CHAIN_ID=42220
CELO_RPC_URL=https://forno.celo.org
CELO_TESTNET_RPC_URL=https://alfajores-forno.celo-testnet.org

# Contracts
CUSD_ADDRESS=0x765DE816845861e75A25fCA122bb6898B8B1282a
CHESS_ESCROW_ADDRESS=<diisi setelah deploy>
CHESS_PUZZLE_ADDRESS=<diisi setelah deploy>

# Game Config
STAKE_OPTIONS=0.50,1.00,2.00
PLATFORM_FEE_PERCENT=5
GAME_TIMEOUT_MS=300000          # 5 menit waiting for opponent
DISCONNECT_TIMEOUT_MS=60000     # 60 detik auto-forfeit
CLOCK_SYNC_INTERVAL_MS=10000    # sync clock tiap 10 detik
```

### 8.2 FE Specific

```env
NEXT_PUBLIC_API_URL=https://api.chessminipay.xyz
NEXT_PUBLIC_WS_URL=wss://api.chessminipay.xyz/ws
NEXT_PUBLIC_CELO_CHAIN_ID=42220
NEXT_PUBLIC_CHESS_ESCROW_ADDRESS=<diisi setelah deploy>
NEXT_PUBLIC_CUSD_ADDRESS=0x765DE816845861e75A25fCA122bb6898B8B1282a
```

### 8.3 BE Specific

```env
SUPABASE_URL=<url>
SUPABASE_SERVICE_KEY=<key>
SERVER_WALLET_PRIVATE_KEY=<JANGAN COMMIT — pakai .env.local>
JWT_SECRET=<random 64 chars>
STOCKFISH_PATH=./stockfish-wasm
```

### 8.4 SC Specific

```env
DEPLOYER_PRIVATE_KEY=<JANGAN COMMIT>
CELOSCAN_API_KEY=<untuk verify>
SERVER_WALLET_ADDRESS=<BE server wallet yang dapat SERVER_ROLE>
TREASURY_ADDRESS=<wallet untuk platform fee>
```

---

## 9. Checklist Sync Points

### SYNC 1 — Akhir Hari 3

- [ ] **SC:** ABI file (`ChessEscrow.json`) di-commit ke shared repo
- [ ] **SC:** Contract address testnet di-share ke grup
- [ ] **SC:** Event signatures confirmed
- [ ] **BE:** REST endpoints `/game/create`, `/game/join`, `/game/lobby` bisa di-hit (return mock data OK)
- [ ] **BE:** WebSocket basic connect dan `game:join` event berfungsi
- [ ] **FE:** MiniPay wallet connect berfungsi
- [ ] **FE:** Chess board render dan bisa gerak pieces (local, belum connect BE)
- [ ] **SEMUA:** Test `depositStake()` dari FE → SC di testnet berhasil

### SYNC 2 — Akhir Hari 6

- [ ] **SC:** Contract deployed di Celo Mainnet + verified di Celoscan
- [ ] **BE:** Full game flow jalan (create → join → play → resolve)
- [ ] **BE:** Smart contract integration (listen events, call resolveGame)
- [ ] **BE:** Stockfish bot mode berfungsi
- [ ] **FE:** Full UI flow (lobby → game → result) connected ke BE
- [ ] **FE:** Stake deposit + payout display berfungsi
- [ ] **SEMUA:** End-to-end test di testnet: buat game → deposit → main → menang → cUSD masuk

### SYNC 3 — Akhir Hari 8

- [ ] **SEMUA:** Mainnet live dan berfungsi
- [ ] **SEMUA:** 5-10 test users sudah main dan generate onchain TX
- [ ] **SC:** Semua edge cases handled (double deposit, refund timeout, dll)
- [ ] **BE:** Daily puzzle berjalan dengan cron
- [ ] **FE:** Leaderboard dan daily puzzle page selesai
- [ ] **FE:** Mobile responsive dan smooth di MiniPay browser

---

## Catatan Penting

### MiniPay Constraints (SEMUA HARUS TAHU)

1. **Legacy transactions only** — properti EIP-1559 tidak diproses
2. **Message signing belum di-support** — jangan pakai signMessage()
3. **Pakai viem atau wagmi** — Ethers.js tidak support Celo Fee Abstraction
4. **Test di MiniPay Site Tester** — bukan di browser biasa

### Wallet Safety

**JANGAN PERNAH pakai wallet pribadi untuk development.** Selalu pakai wallet terpisah (burner wallet) untuk testing. SC deployer wallet dan BE server wallet harus berbeda dari wallet pribadi.

### Git Workflow

```
main          ← production, hanya merge dari dev
├── dev       ← integration branch
│   ├── fe/*  ← feature branches FE
│   ├── be/*  ← feature branches BE
│   └── sc/*  ← feature branches SC
```

Merge ke `dev` setiap sync point. Merge ke `main` hanya kalau semua checklist di sync point terpenuhi.

---

*Dokumen ini hidup — update kalau ada perubahan interface. Komunikasikan setiap perubahan di grup chat.*
