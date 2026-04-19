import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { ERRORS, JWTPayload } from "../types";

declare global {
  namespace Express {
    interface Request {
      playerAddress?: string;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(ERRORS.AUTH_REQUIRED.status).json(ERRORS.AUTH_REQUIRED);
    return;
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
    req.playerAddress = decoded.wallet_address;
    next();
  } catch {
    res.status(ERRORS.AUTH_INVALID.status).json(ERRORS.AUTH_INVALID);
  }
}
