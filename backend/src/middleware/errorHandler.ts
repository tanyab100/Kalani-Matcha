import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { ErrorCode } from "../types/errors";

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: ErrorCode.VALIDATION_ERROR,
      message: "Invalid request data",
      details: err.errors,
    });
    return;
  }

  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? ErrorCode.INTERNAL_ERROR;
  const message = statusCode === 500 ? "Internal server error" : err.message;

  if (statusCode === 500) {
    console.error("[Error]", err);
  }

  res.status(statusCode).json({ error: code, message });
}

export function createError(
  message: string,
  statusCode: number,
  code: string
): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}
