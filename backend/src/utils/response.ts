import { Response } from "express";

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function success<T>(res: Response, data: T, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

export function fail(res: Response, code: string, message: string, statusCode = 400) {
  return res.status(statusCode).json({
    success: false,
    error: { code, message },
  });
}

export function handleError(res: Response, error: unknown) {
  if (error instanceof AppError) {
    return fail(res, error.code, error.message, error.statusCode);
  }
  console.error(error);
  return fail(res, "INTERNAL_ERROR", "An unexpected error occurred", 500);
}
