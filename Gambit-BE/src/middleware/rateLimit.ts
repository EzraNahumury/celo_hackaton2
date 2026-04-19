import { Request, Response, NextFunction } from "express";
import { ERRORS } from "../types";

const requestCounts = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(maxRequests: number = 100, windowMs: number = 60000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.playerAddress || req.ip || "unknown";
    const now = Date.now();

    const entry = requestCounts.get(key);
    if (!entry || now > entry.resetAt) {
      requestCounts.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    entry.count++;
    if (entry.count > maxRequests) {
      res.status(ERRORS.RATE_LIMIT.status).json(ERRORS.RATE_LIMIT);
      return;
    }

    next();
  };
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of requestCounts) {
    if (now > entry.resetAt) requestCounts.delete(key);
  }
}, 300000);
