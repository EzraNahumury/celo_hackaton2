# CLAUDE.md — Chess MiniPay Backend

> File ini dibaca otomatis oleh Claude Code sebagai konteks project.
> Role: BACKEND DEVELOPER

## Project Overview

Chess MiniPay adalah web3 chess game di Celo blockchain, dimainkan via MiniPay browser.
BE bertanggung jawab atas: game logic, matchmaking, move validation, clock management,
smart contract interaction (resolve game, refund), Stockfish bot, dan daily puzzle.

Prinsip: **Game logic di server, uang di blockchain.**

## Tech Stack

- **Runtime:** Node.js 20+ (TypeScript)
- **Framework:** Express.js (atau Fastify)
- **Database:** Supabase (PostgreSQL + Realtime)
- **WebSocket:** ws library atau Supabase Realtime Broadcast
- **Chess Engine:** chess.js (move validation) + Stockfish WASM (bot mode)
- **Blockchain:** viem (interact dengan ChessEscrow contract)
- **Auth:** JWT (wallet-based, nonce verification via micro-tx)
- **Hosting:** Railway atau Render
- **Cron:** node-cron (expire games, daily puzzle)

## Folder Structure

```
src/
├── server.ts                   # Express app entry point
├── config/
│   ├── env.ts                  # Environment variables
│   ├── supabase.ts             # Supabase client (service_role key)
│   └── blockchain.ts           # Viem client + contract instances
├── routes/
│   ├── auth.ts                 # GET /auth/nonce, POST /auth/verify
│   ├── game.ts                 # CRUD game + move + resign
│   ├── puzzle.ts               # GET /puzzle/daily, POST /puzzle/daily/submit
│   └── leaderboard.ts          # GET /leaderboard
├── services/
│   ├── gameService.ts          # Core game logic
│   ├── matchmakingService.ts   # Match players, assign colors
│   ├── chessEngine.ts          # chess.js wrapper + move validation
│   ├── stockfish.ts            # Stockfish WASM integration
│   ├── clockService.ts         # Timer management per game
│   ├── escrowService.ts        # Smart contract interactions
│   ├── puzzleService.ts        # Generate + validate daily puzzles
│   ├── eloService.ts           # ELO rating calculations
│   └── playerService.ts        # Player CRUD + stats update
├── ws/
│   ├── wsServer.ts             # WebSocket server setup
│   ├── gameRoom.ts             # Per-game room logic
│   └── handlers.ts             # Event handlers (move, resign, draw)
├── middleware/
│   ├── auth.ts                 # JWT verification middleware
│   └── rateLimit.ts            # Rate limiting
├── contracts/
│   ├── ChessEscrow.json        # ABI dari SC (copy paste setelah deploy)
│   └── erc20.json              # ERC20 ABI (untuk cUSD read)
├── cron/
│   ├── expireGames.ts          # Expire waiting games setiap menit
│   └── dailyPuzzle.ts          # Generate puzzle setiap 00:00 UTC
├── types/
│   └── index.ts                # Shared types
└── utils/
    ├── logger.ts               # Winston/Pino logger
    └── helpers.ts              # Formatting, validation
```

## Database Schema (Supabase)

BE menggunakan Supabase service_role key (bypass RLS).
Schema lengkap ada di `chess_minipay_schema.sql` — jalankan langsung di Supabase SQL Editor.

### Custom Enums (PostgreSQL)

```sql
CREATE TYPE game_status AS ENUM ('waiting', 'active', 'completed', 'cancelled', 'expired');
CREATE TYPE game_result AS ENUM ('white_win', 'black_win', 'draw', 'abort');
CREATE TYPE game_mode   AS ENUM ('pvp', 'bot');
CREATE TYPE tx_type     AS ENUM ('deposit', 'payout', 'refund', 'fee');
CREATE TYPE tx_status   AS ENUM ('pending', 'confirmed', 'failed');
```

### Tabel: players

```
wallet_address  TEXT PRIMARY KEY           -- "0x..." lowercase, ini PK bukan UUID
username        TEXT UNIQUE                -- display name, opsional
rating          INT DEFAULT 1200           -- ELO rating
wins            INT DEFAULT 0
losses          INT DEFAULT 0
draws           INT DEFAULT 0
total_earned    NUMERIC(12,2) DEFAULT 0    -- total cUSD earned
created_at      TIMESTAMPTZ DEFAULT NOW()
last_seen       TIMESTAMPTZ DEFAULT NOW()
```

Indexes: `rating DESC`, `wins DESC`, `total_earned DESC` (untuk leaderboard).

### Tabel: games

```
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
onchain_game_id  TEXT UNIQUE                    -- bytes32 di smart contract
white_address    TEXT REFERENCES players(wallet_address)
black_address    TEXT REFERENCES players(wallet_address)
status           game_status DEFAULT 'waiting'
result           game_result                    -- NULL sampai game selesai
mode             game_mode DEFAULT 'pvp'
stake_amount     NUMERIC(6,2) NOT NULL          -- CHECK: 0.50, 1.00, atau 2.00
time_control     TEXT NOT NULL DEFAULT '3+0'
fen              TEXT DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
white_time_ms    INT                            -- sisa waktu putih (ms)
black_time_ms    INT                            -- sisa waktu hitam (ms)
move_count       INT DEFAULT 0
winner_address   TEXT REFERENCES players(wallet_address)
end_reason       TEXT                           -- "checkmate","timeout","resignation", dll
created_at       TIMESTAMPTZ DEFAULT NOW()
started_at       TIMESTAMPTZ                    -- saat player kedua join
ended_at         TIMESTAMPTZ
expires_at       TIMESTAMPTZ                    -- auto-expire waiting games
```

Constraints: `valid_stake CHECK (stake_amount IN (0.50, 1.00, 2.00))`, `different_players CHECK (white_address != black_address)`.
Partial indexes: `status WHERE status IN ('waiting','active')`, `onchain_game_id WHERE NOT NULL`.
Realtime enabled: `ALTER PUBLICATION supabase_realtime ADD TABLE games;`

### Tabel: moves

```
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
game_id           UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE
player_address    TEXT NOT NULL REFERENCES players(wallet_address)
move_number       INT NOT NULL               -- 1, 2, 3, ...
uci_move          TEXT NOT NULL               -- "e2e4", "e1g1"
fen_after         TEXT NOT NULL               -- board state setelah move
time_remaining_ms INT                         -- sisa waktu player setelah move
created_at        TIMESTAMPTZ DEFAULT NOW()
```

Constraint: `UNIQUE (game_id, move_number)`.
Realtime enabled: `ALTER PUBLICATION supabase_realtime ADD TABLE moves;`

### Tabel: transactions

```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
game_id         UUID REFERENCES games(id)
player_address  TEXT NOT NULL REFERENCES players(wallet_address)
tx_type         tx_type NOT NULL             -- 'deposit','payout','refund','fee'
tx_hash         TEXT UNIQUE                  -- Celo tx hash
amount          NUMERIC(12,6) NOT NULL       -- jumlah cUSD (6 decimal places)
status          tx_status DEFAULT 'pending'  -- 'pending','confirmed','failed'
created_at      TIMESTAMPTZ DEFAULT NOW()
confirmed_at    TIMESTAMPTZ
```

### Tabel: puzzles

```
id           TEXT PRIMARY KEY               -- "puzzle-2026-04-17"
fen          TEXT NOT NULL
to_move      TEXT NOT NULL DEFAULT 'white'
solution     JSONB NOT NULL                 -- ["h5f7"] array of UCI moves
prize_pool   NUMERIC(12,2) DEFAULT 5.00
participants INT DEFAULT 0
puzzle_date  DATE NOT NULL UNIQUE           -- 1 puzzle per hari
expires_at   TIMESTAMPTZ NOT NULL
created_at   TIMESTAMPTZ DEFAULT NOW()
```

### Tabel: puzzle_attempts

```
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
puzzle_id       TEXT NOT NULL REFERENCES puzzles(id)
player_address  TEXT NOT NULL REFERENCES players(wallet_address)
submitted_moves JSONB NOT NULL              -- ["h5f7"]
correct         BOOLEAN NOT NULL
solve_time_ms   INT
rank            INT
reward          NUMERIC(12,2) DEFAULT 0
created_at      TIMESTAMPTZ DEFAULT NOW()
```

Constraint: `UNIQUE (puzzle_id, player_address)` — satu attempt per player per puzzle.

### Helper Functions di Database (panggil via Supabase RPC)

```typescript
// Update player stats setelah game selesai
await supabase.rpc("update_player_stats", {
  p_address: "0x...",
  p_result: "win", // 'win' | 'loss' | 'draw'
  p_earned: 0.95,
});

// Get leaderboard
await supabase.rpc("get_leaderboard", {
  p_period: "weekly", // 'weekly' | 'monthly' | 'all'
  p_limit: 20,
});

// Calculate ELO
await supabase.rpc("calculate_elo", {
  p_winner_rating: 1200,
  p_loser_rating: 1150,
  p_is_draw: false,
});
// Returns: { new_winner_rating: 1216, new_loser_rating: 1134 }

// Expire stale games (panggil dari cron)
await supabase.rpc("expire_stale_games");
// Returns: jumlah game yang di-expire
```

### RLS Policies

BE menggunakan `service_role` key yang bypass semua RLS.
FE menggunakan `anon` key — RLS berlaku:

- `players`, `games`, `moves`, `puzzles`, `puzzle_attempts` → publicly readable
- `transactions` → hanya player sendiri yang bisa baca
- Semua INSERT/UPDATE hanya dari BE (via service_role)

## API Endpoints yang Harus Diimplementasi

### Auth

```
GET  /auth/nonce?address=0x...
  → Return { nonce: "random-string", expiresAt: "..." }
  → Simpan nonce di DB/Redis dengan TTL 5 menit

POST /auth/verify
  Body: { address: "0x...", txHash: "0x..." }
  → Verify micro-tx (0.001 cUSD) ke treasury dengan nonce di memo
  → Return { token: "jwt...", expiresIn: 86400 }
```

### Game

```
POST /game/create
  Auth: Bearer JWT
  Body: { stake: "0.50", timeControl: "3+0", color: "random", mode: "pvp"|"bot" }
  Logic:
    1. Generate UUID gameId
    2. Generate onchainGameId (keccak256 dari gameId)
    3. Insert ke tabel games (status: "waiting")
    4. Set expires_at = now + 5 menit
    5. Kalau mode "bot" → langsung set status "active", assign bot address
    6. Return gameId, onchainGameId, depositTx info
  Response: 201 { gameId, onchainGameId, status, depositTx: { to, functionName, args } }

POST /game/join
  Auth: Bearer JWT
  Body: { gameId: "uuid" }
  Logic:
    1. Check game status == "waiting"
    2. Check player bukan creator
    3. Assign color (random atau sesuai preference)
    4. Update game: black_address, status "waiting" (tetap waiting sampai kedua deposit masuk)
    5. Return game state + depositTx info
  Response: 200 { gameId, white, black, stake, depositTx }

GET  /game/:gameId
  Response: 200 { full game state termasuk fen, times, moves }

GET  /game/lobby
  Query: ?stake=0.50&timeControl=3+0
  Logic: SELECT * FROM games WHERE status='waiting' AND expires_at > NOW()
  Response: 200 { games: [...] }

POST /game/:gameId/move
  Auth: Bearer JWT
  Body: { move: "e2e4" }
  Logic:
    1. Validate giliran player (from fen, white/black)
    2. Validate move dengan chess.js
    3. Update fen, times, move_count
    4. Insert ke tabel moves
    5. Check game over (checkmate, stalemate, insufficient, dll)
    6. Kalau game over → trigger resolveGame di smart contract
    7. Broadcast via WS atau Supabase Realtime
    8. Kalau mode bot → generate Stockfish response, repeat dari step 2
  Response: 200 { valid, fen, whiteTimeMs, blackTimeMs, gameOver, result }

POST /game/:gameId/resign
  Auth: Bearer JWT
  Logic:
    1. Update game result (lawan menang)
    2. Trigger resolveGame di smart contract
    3. Update player stats (ELO)
    4. Broadcast game:end via WS
  Response: 200 { result, payoutTxHash }
```

### Puzzle

```
GET  /puzzle/daily
  Logic: SELECT * FROM puzzles WHERE puzzle_date = CURRENT_DATE
  Response: 200 { puzzleId, fen, toMove, prizePool, participants, expiresAt }
  CATATAN: JANGAN return solution!

POST /puzzle/daily/submit
  Auth: Bearer JWT
  Body: { puzzleId, moves: ["h5f7"], timeMs: 4200 }
  Logic:
    1. Check puzzle belum expired
    2. Check player belum pernah submit (constraint unique)
    3. Validate moves against solution (JSONB compare)
    4. Insert puzzle_attempt
    5. Update participants count
    6. Calculate rank by solve_time_ms
  Response: 200 { correct, rank, totalParticipants, reward }
```

### Leaderboard

```
GET  /leaderboard
  Query: ?period=weekly|monthly|all&limit=20
  Logic: Call function get_leaderboard(period, limit) di Supabase
  Response: 200 { period, entries: [{ rank, address, wins, losses, rating, totalEarned }] }
```

## WebSocket Logic

### Connection

```typescript
// ws/wsServer.ts
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ noServer: true });

// Upgrade HTTP → WS
server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, "http://localhost");
  const gameId = url.searchParams.get("gameId");
  const token = url.searchParams.get("token");

  // Verify JWT
  const decoded = verifyJWT(token);
  if (!decoded) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.gameId = gameId;
    ws.playerAddress = decoded.wallet_address;
    wss.emit("connection", ws, req);
  });
});
```

### Game Room Pattern

```typescript
// ws/gameRoom.ts
const gameRooms = new Map<string, Set<WebSocket>>();

function joinRoom(gameId: string, ws: WebSocket) {
  if (!gameRooms.has(gameId)) gameRooms.set(gameId, new Set());
  gameRooms.get(gameId).add(ws);
}

function broadcastToGame(gameId: string, event: object, exclude?: WebSocket) {
  const room = gameRooms.get(gameId);
  if (!room) return;
  const msg = JSON.stringify(event);
  room.forEach((ws) => {
    if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  });
}
```

### Event Handlers

```typescript
// ws/handlers.ts
ws.on('message', async (raw) => {
  const msg = JSON.parse(raw.toString());

  switch (msg.event) {
    case 'move:send':
      const result = await gameService.makeMove(msg.gameId, ws.playerAddress, msg.move);
      if (result.valid) {
        broadcastToGame(msg.gameId, {
          event: 'move:made',
          gameId: msg.gameId,
          move: msg.move,
          fen: result.fen,
          whiteTimeMs: result.whiteTimeMs,
          blackTimeMs: result.blackTimeMs,
          moveNumber: result.moveNumber,
        });

        // Bot response kalau mode bot
        if (result.isBotGame && !result.gameOver) {
          const botMove = await stockfish.getBestMove(result.fen, difficulty);
          // ... process bot move, broadcast
        }

        if (result.gameOver) {
          const payout = await escrowService.resolveGame(...);
          broadcastToGame(msg.gameId, {
            event: 'game:end',
            result: result.result,
            payoutTxHash: payout.txHash,
          });
        }
      } else {
        ws.send(JSON.stringify({ event: 'move:invalid', reason: result.reason }));
      }
      break;

    case 'draw:offer':
      broadcastToGame(msg.gameId, {
        event: 'draw:offered', by: ws.playerAddress
      }, ws);  // exclude sender
      break;

    case 'game:resign':
      // ... handle resign
      break;
  }
});
```

## Smart Contract Interaction

BE punya SERVER_ROLE di smart contract. Pakai viem dengan server wallet.

```typescript
// config/blockchain.ts
import { createWalletClient, createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.SERVER_WALLET_PRIVATE_KEY as `0x${string}`);

export const walletClient = createWalletClient({
  account,
  chain: celo,
  transport: http("https://forno.celo.org"),
});

export const publicClient = createPublicClient({
  chain: celo,
  transport: http("https://forno.celo.org"),
});
```

```typescript
// services/escrowService.ts
import { walletClient, publicClient } from "../config/blockchain";
import ChessEscrowABI from "../contracts/ChessEscrow.json";

const ESCROW_ADDRESS = process.env.CHESS_ESCROW_ADDRESS as `0x${string}`;

export async function resolveGame(onchainGameId: `0x${string}`, winner: `0x${string}`, player1: `0x${string}`, player2: `0x${string}`) {
  const txHash = await walletClient.writeContract({
    address: ESCROW_ADDRESS,
    abi: ChessEscrowABI,
    functionName: "resolveGame",
    args: [onchainGameId, winner, player1, player2],
    // PENTING: Celo legacy transaction, JANGAN pakai maxFeePerGas
  });

  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  // Log ke tabel transactions
  await supabase.from("transactions").insert({
    game_id: gameId,
    player_address: winner,
    tx_type: "payout",
    tx_hash: txHash,
    amount: winnerPayout,
    status: receipt.status === "success" ? "confirmed" : "failed",
  });

  return { txHash, receipt };
}

export async function refundStake(onchainGameId: `0x${string}`, player: `0x${string}`) {
  const txHash = await walletClient.writeContract({
    address: ESCROW_ADDRESS,
    abi: ChessEscrowABI,
    functionName: "refundStake",
    args: [onchainGameId, player],
  });
  return { txHash };
}
```

### Listen Contract Events (untuk confirm deposit)

```typescript
// services/escrowService.ts
export function watchDeposits() {
  publicClient.watchContractEvent({
    address: ESCROW_ADDRESS,
    abi: ChessEscrowABI,
    eventName: "StakeDeposited",
    onLogs: async (logs) => {
      for (const log of logs) {
        const { gameId, player, amount } = log.args;
        // Update game di DB
        // Kalau kedua player sudah deposit → set status "active"
        await handleDepositConfirmed(gameId, player, amount);
      }
    },
  });
}
```

## Stockfish Integration

```typescript
// services/stockfish.ts
import { Worker } from "worker_threads";

const SKILL_LEVELS = {
  1: { skillLevel: 0, depth: 1 }, // Pemula
  2: { skillLevel: 5, depth: 3 }, // Mudah
  3: { skillLevel: 10, depth: 5 }, // Sedang
  4: { skillLevel: 15, depth: 8 }, // Sulit
  5: { skillLevel: 20, depth: 12 }, // Expert
};

export async function getBestMove(fen: string, difficulty: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker("./stockfish.wasm.js");
    const config = SKILL_LEVELS[difficulty] || SKILL_LEVELS[3];

    worker.postMessage("uci");
    worker.postMessage(`setoption name Skill Level value ${config.skillLevel}`);
    worker.postMessage(`position fen ${fen}`);
    worker.postMessage(`go depth ${config.depth}`);

    worker.on("message", (msg: string) => {
      if (msg.startsWith("bestmove")) {
        const move = msg.split(" ")[1]; // "e2e4"
        resolve(move);
        worker.terminate();
      }
    });

    // Timeout 10 detik
    setTimeout(() => {
      worker.terminate();
      reject(new Error("Stockfish timeout"));
    }, 10000);
  });
}
```

## Clock Management

```typescript
// services/clockService.ts
const activeClocks = new Map<string, NodeJS.Timeout>();

export function startClock(gameId: string, initialTimeMs: number, increment: number) {
  // Parse time control "3+2" → 180000ms + 2000ms increment
  // Store per-game clock state in memory
}

export function pauseClock(gameId: string) {
  clearInterval(activeClocks.get(gameId));
}

export function switchTurn(gameId: string) {
  // Pause current player clock
  // Add increment to current player
  // Start opponent clock
  // Broadcast clock:sync setiap 10 detik
}

export function checkTimeout(gameId: string): string | null {
  // Return 'white_timeout' | 'black_timeout' | null
  // Kalau timeout → trigger game end
}
```

## Cron Jobs

```typescript
// cron/expireGames.ts
import cron from "node-cron";

// Setiap menit: expire waiting games
cron.schedule("* * * * *", async () => {
  const { data } = await supabase
    .from("games")
    .update({ status: "expired", ended_at: new Date().toISOString() })
    .eq("status", "waiting")
    .lt("expires_at", new Date().toISOString())
    .select();

  // Refund deposits kalau ada
  for (const game of data || []) {
    if (game.onchain_game_id) {
      await escrowService.refundStake(game.onchain_game_id, game.white_address);
    }
  }
});

// Setiap hari 00:00 UTC: generate daily puzzle
cron.schedule("0 0 * * *", async () => {
  // Fetch puzzle dari lichess puzzle API atau pre-seeded database
  // Insert ke tabel puzzles
});
```

## Error Codes

```typescript
const ERRORS = {
  AUTH_REQUIRED: { code: "AUTH_REQUIRED", status: 401 },
  AUTH_INVALID: { code: "AUTH_INVALID", status: 403 },
  GAME_NOT_FOUND: { code: "GAME_NOT_FOUND", status: 404 },
  GAME_FULL: { code: "GAME_FULL", status: 409 },
  GAME_EXPIRED: { code: "GAME_EXPIRED", status: 410 },
  STAKE_NOT_DEPOSITED: { code: "STAKE_NOT_DEPOSITED", status: 402 },
  INVALID_MOVE: { code: "INVALID_MOVE", status: 422 },
  NOT_YOUR_TURN: { code: "NOT_YOUR_TURN", status: 422 },
  GAME_ALREADY_ENDED: { code: "GAME_ALREADY_ENDED", status: 409 },
  PUZZLE_EXPIRED: { code: "PUZZLE_EXPIRED", status: 410 },
  PUZZLE_ALREADY_SUBMITTED: { code: "PUZZLE_ALREADY_SUBMITTED", status: 409 },
  RATE_LIMIT: { code: "RATE_LIMIT", status: 429 },
  SERVER_ERROR: { code: "SERVER_ERROR", status: 500 },
};
```

## Environment Variables

```env
# Server
PORT=3001
NODE_ENV=development

# Supabase
SUPABASE_URL=<from dashboard>
SUPABASE_SERVICE_KEY=<service_role key — BUKAN anon key>

# Blockchain
CELO_RPC_URL=https://forno.celo.org
CELO_TESTNET_RPC_URL=https://alfajores-forno.celo-testnet.org
SERVER_WALLET_PRIVATE_KEY=<JANGAN COMMIT — pakai .env.local>
CHESS_ESCROW_ADDRESS=<diisi setelah SC deploy>
CUSD_ADDRESS=0x765DE816845861e75A25fCA122bb6898B8B1282a

# Auth
JWT_SECRET=<random 64 chars>

# Stockfish
STOCKFISH_PATH=./stockfish-wasm

# Game Config
GAME_TIMEOUT_MS=300000
DISCONNECT_TIMEOUT_MS=60000
CLOCK_SYNC_INTERVAL_MS=10000
```

## Coding Conventions

- TypeScript strict mode
- Async/await everywhere (no callbacks)
- Semua wallet address disimpan lowercase
- Semua amount dalam string decimal ("0.50") di API, bigint di blockchain interaction
- Log setiap smart contract call (txHash, gas used, success/fail)
- Retry failed blockchain tx max 3 kali dengan exponential backoff
- Git branch prefix: `be/` (contoh: `be/game-service`, `be/stockfish`)

## Dependencies

```bash
npm init -y
npm install express cors helmet chess.js viem @supabase/supabase-js
npm install ws jsonwebtoken node-cron
npm install -D typescript @types/express @types/ws @types/node ts-node nodemon
```

## Deadline & Sync Points

- **Akhir Hari 3:** REST endpoints (create, join, lobby) return mock/real data. WS basic connect berfungsi.
- **Akhir Hari 6:** Full game flow + SC integration + bot mode. E2E test di testnet.
- **Akhir Hari 8:** Mainnet live. Daily puzzle cron running.
- **Hari 9:** Record demo video (screen recording full flow).
- **Hari 10:** Final video edit + upload.

## PENTING: Server Wallet Safety

- **JANGAN** pakai wallet pribadi sebagai server wallet
- Server wallet hanya perlu saldo CELO kecil untuk gas (~0.5 CELO cukup untuk ratusan tx)
- Private key di .env.local — JANGAN commit ke git
- Tambahkan `.env.local` ke `.gitignore`
