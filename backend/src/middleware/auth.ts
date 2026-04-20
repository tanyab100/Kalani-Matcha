import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ErrorCode } from "../types/errors";

export type CustomerRole = "customer" | "store_admin";

export interface AuthenticatedCustomer {
  id: string;
  email: string;
  role: CustomerRole;
}

// Extend Express Request to include customer
declare global {
  namespace Express {
    interface Request {
      customer?: AuthenticatedCustomer;
    }
  }
}

function getSecret(res: Response): string | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ error: ErrorCode.INTERNAL_ERROR, message: "Server misconfiguration" });
    return null;
  }
  return secret;
}

function extractBearer(req: Request, res: Response): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: ErrorCode.UNAUTHORIZED, message: "Missing or invalid Authorization header" });
    return null;
  }
  const token = authHeader.slice(7);
  if (!token) {
    res.status(401).json({ error: ErrorCode.UNAUTHORIZED, message: "Missing or invalid Authorization header" });
    return null;
  }
  return token;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearer(req, res);
  if (!token) return;

  const secret = getSecret(res);
  if (!secret) return;

  try {
    const payload = jwt.verify(token, secret) as AuthenticatedCustomer & jwt.JwtPayload;
    req.customer = { id: payload.id, email: payload.email, role: payload.role ?? "customer" };
    next();
  } catch {
    res.status(401).json({ error: ErrorCode.UNAUTHORIZED, message: "Invalid or expired token" });
  }
}

/**
 * Middleware that restricts access to Store_Admin role only.
 * Verifies JWT and checks role === 'store_admin'.
 * Requirements: 11.3
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearer(req, res);
  if (!token) return;

  const secret = getSecret(res);
  if (!secret) return;

  try {
    const payload = jwt.verify(token, secret) as AuthenticatedCustomer & jwt.JwtPayload;
    if (payload.role !== "store_admin") {
      res.status(403).json({ error: ErrorCode.FORBIDDEN, message: "Store_Admin role required" });
      return;
    }
    req.customer = { id: payload.id, email: payload.email, role: "store_admin" };
    next();
  } catch {
    res.status(401).json({ error: ErrorCode.UNAUTHORIZED, message: "Invalid or expired token" });
  }
}
