import type { Request, Response, NextFunction } from "express";
import { createError } from "./errorHandler";

interface Window {
  count: number;
  resetAt: number;
}

/**
 * Lightweight in-memory rate limiter keyed by IP address.
 * Suitable for a single-process server (popup shop scale).
 * For multi-process deployments, replace with Redis-backed rate limiting.
 *
 * @param maxRequests  Max requests allowed per window
 * @param windowMs     Window duration in milliseconds
 */
export function rateLimit(maxRequests: number, windowMs: number) {
  const windows = new Map<string, Window>();

  // Prune stale entries every windowMs to avoid unbounded memory growth
  setInterval(() => {
    const now = Date.now();
    for (const [key, w] of windows) {
      if (w.resetAt <= now) windows.delete(key);
    }
  }, windowMs).unref();

  return (req: Request, _res: Response, next: NextFunction): void => {
    const ip =
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0].trim() ??
      req.socket.remoteAddress ??
      "unknown";

    const now = Date.now();
    let w = windows.get(ip);

    if (!w || w.resetAt <= now) {
      w = { count: 0, resetAt: now + windowMs };
      windows.set(ip, w);
    }

    w.count++;

    if (w.count > maxRequests) {
      next(createError("Too many requests", 429, "RATE_LIMITED"));
      return;
    }

    next();
  };
}
