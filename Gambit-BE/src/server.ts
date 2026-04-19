import express from "express";
import cors from "cors";
import helmet from "helmet";
import http from "http";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { rateLimit } from "./middleware/rateLimit";

// Routes
import authRouter from "./routes/auth";
import gameRouter from "./routes/game";
import puzzleRouter from "./routes/puzzle";
import leaderboardRouter from "./routes/leaderboard";

// WebSocket
import { setupWebSocket } from "./ws/wsServer";

// Cron
import { startExpireGamesCron } from "./cron/expireGames";
import { startDailyPuzzleCron } from "./cron/dailyPuzzle";

// Escrow watcher
import { watchDeposits } from "./services/escrowService";

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(rateLimit(100, 60000));

// Swagger docs
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: "Gambit API Docs",
}));
app.get("/api-docs.json", (_req, res) => {
  res.json(swaggerSpec);
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/auth", authRouter);
app.use("/game", gameRouter);
app.use("/puzzle", puzzleRouter);
app.use("/leaderboard", leaderboardRouter);

// Create HTTP server
const server = http.createServer(app);

// Setup WebSocket
setupWebSocket(server);

// Start server
server.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT} (${env.NODE_ENV})`);

  // Start cron jobs
  startExpireGamesCron();
  startDailyPuzzleCron();

  // Watch blockchain deposits
  watchDeposits();
});

export default server;
