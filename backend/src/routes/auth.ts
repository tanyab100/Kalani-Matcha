import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { pool } from "../db/pool";
import { ErrorCode } from "../types/errors";

export const authRouter = Router();

const SALT_ROUNDS = 10;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is not set");
  return secret;
}

const registerSchema = z.object({
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
  password: z.string().transform((v) => v.trim()).pipe(z.string().min(8, "Password must be at least 8 characters")),
});

const loginSchema = z.object({
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
  password: z.string().transform((v) => v.trim()).pipe(z.string().min(1)),
});

// POST /auth/register
authRouter.post("/register", async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ErrorCode.VALIDATION_ERROR, message: "Invalid request data", details: parsed.error.flatten() });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const existing = await pool.query(
      "SELECT id FROM customers WHERE email = $1",
      [email]
    );
    if (existing.rows.length > 0) {
      res.status(409).json({ error: "EMAIL_TAKEN", message: "Email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      "INSERT INTO customers (email, password_hash) VALUES ($1, $2) RETURNING id, email, role, created_at",
      [email, passwordHash]
    );

    const customer = result.rows[0];
    const token = jwt.sign(
      { id: customer.id, email: customer.email, role: customer.role },
      getJwtSecret(),
      { expiresIn: "7d" }
    );

    res.status(201).json({ token, customer: { id: customer.id, email: customer.email, role: customer.role } });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: ErrorCode.INTERNAL_ERROR, message: "Registration failed" });
  }
});

// POST /auth/login
authRouter.post("/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: ErrorCode.VALIDATION_ERROR, message: "Invalid request data", details: parsed.error.flatten() });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const result = await pool.query(
      "SELECT id, email, role, password_hash FROM customers WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: ErrorCode.INVALID_CREDENTIALS, message: "Invalid email or password" });
      return;
    }

    const customer = result.rows[0];
    const valid = await bcrypt.compare(password, customer.password_hash);

    if (!valid) {
      res.status(401).json({ error: ErrorCode.INVALID_CREDENTIALS, message: "Invalid email or password" });
      return;
    }

    const token = jwt.sign(
      { id: customer.id, email: customer.email, role: customer.role },
      getJwtSecret(),
      { expiresIn: "7d" }
    );

    res.json({ token, customer: { id: customer.id, email: customer.email, role: customer.role } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: ErrorCode.INTERNAL_ERROR, message: "Login failed" });
  }
});
