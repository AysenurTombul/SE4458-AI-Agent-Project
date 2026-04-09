import { NextFunction, Request, Response } from "express";
import env from "../config/env";
import { AppError } from "../utils/errors";

const store = new Map<string, { count: number; resetAt: number }>();

export const dailyLimit = (limit = env.RATE_LIMIT_MAX_PER_DAY) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const key = req.ip || req.headers["x-forwarded-for"]?.toString() || "anonymous";
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || entry.resetAt < now) {
      store.set(key, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
      return next();
    }

    // if (entry.count >= limit) {
    //   throw new AppError("Query limit reached for today", 429);
    // }

    entry.count += 1;
    store.set(key, entry);
    next();
  };
};
