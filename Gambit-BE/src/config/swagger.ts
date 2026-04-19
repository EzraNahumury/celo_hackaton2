import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Gambit — Chess MiniPay API",
      version: "1.0.0",
      description:
        "Backend API for Gambit, a web3 chess game on Celo blockchain played via MiniPay browser. Handles game logic, matchmaking, move validation, clock management, smart contract interaction, Stockfish bot, and daily puzzles.",
      contact: { name: "Gambit Team" },
    },
    servers: [
      { url: "http://localhost:3001", description: "Development" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT obtained from POST /auth/verify",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            code: { type: "string" },
            status: { type: "integer" },
          },
        },
        Player: {
          type: "object",
          properties: {
            wallet_address: { type: "string", example: "0xabc...def" },
            username: { type: "string", nullable: true },
            rating: { type: "integer", example: 1200 },
            wins: { type: "integer" },
            losses: { type: "integer" },
            draws: { type: "integer" },
            total_earned: { type: "number", example: 5.25 },
            created_at: { type: "string", format: "date-time" },
          },
        },
        Game: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            onchain_game_id: { type: "string" },
            white_address: { type: "string", nullable: true },
            black_address: { type: "string", nullable: true },
            status: {
              type: "string",
              enum: ["waiting", "active", "completed", "cancelled", "expired"],
            },
            result: {
              type: "string",
              enum: ["white_win", "black_win", "draw", "abort"],
              nullable: true,
            },
            mode: { type: "string", enum: ["pvp", "bot"] },
            stake_amount: { type: "number", example: 0.5 },
            time_control: { type: "string", example: "3+0" },
            fen: { type: "string" },
            white_time_ms: { type: "integer" },
            black_time_ms: { type: "integer" },
            move_count: { type: "integer" },
            winner_address: { type: "string", nullable: true },
            end_reason: { type: "string", nullable: true },
            created_at: { type: "string", format: "date-time" },
            started_at: { type: "string", format: "date-time", nullable: true },
            ended_at: { type: "string", format: "date-time", nullable: true },
          },
        },
        Move: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            game_id: { type: "string", format: "uuid" },
            player_address: { type: "string" },
            move_number: { type: "integer" },
            uci_move: { type: "string", example: "e2e4" },
            fen_after: { type: "string" },
            time_remaining_ms: { type: "integer" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        MoveResult: {
          type: "object",
          properties: {
            valid: { type: "boolean" },
            fen: { type: "string" },
            whiteTimeMs: { type: "integer" },
            blackTimeMs: { type: "integer" },
            moveNumber: { type: "integer" },
            gameOver: { type: "boolean" },
            result: {
              type: "string",
              enum: ["white_win", "black_win", "draw"],
              nullable: true,
            },
            isBotGame: { type: "boolean" },
          },
        },
        Puzzle: {
          type: "object",
          properties: {
            id: { type: "string", example: "puzzle-2026-04-18" },
            fen: { type: "string" },
            to_move: { type: "string", enum: ["white", "black"] },
            prize_pool: { type: "number" },
            participants: { type: "integer" },
            puzzle_date: { type: "string", format: "date" },
            expires_at: { type: "string", format: "date-time" },
          },
        },
        LeaderboardEntry: {
          type: "object",
          properties: {
            rank: { type: "integer" },
            address: { type: "string" },
            username: { type: "string", nullable: true },
            wins: { type: "integer" },
            losses: { type: "integer" },
            draws: { type: "integer" },
            rating: { type: "integer" },
            totalEarned: { type: "number" },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
