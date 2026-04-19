const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

const currentLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === "production" ? "info" : "debug");

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] <= LOG_LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, message: string, meta?: object): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

export const logger = {
  error(message: string, meta?: object) {
    if (shouldLog("error")) console.error(formatMessage("error", message, meta));
  },
  warn(message: string, meta?: object) {
    if (shouldLog("warn")) console.warn(formatMessage("warn", message, meta));
  },
  info(message: string, meta?: object) {
    if (shouldLog("info")) console.log(formatMessage("info", message, meta));
  },
  debug(message: string, meta?: object) {
    if (shouldLog("debug")) console.log(formatMessage("debug", message, meta));
  },
};
