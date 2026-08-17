import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import { prisma } from "../config/database.js";
import { AppError, fail } from "./response.js";
import { Role } from "@prisma/client";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return fail(res, "UNAUTHORIZED", "Authentication required", 401);
    }
    const token = header.slice(7);
    const payload = jwt.verify(token, config.jwt.secret) as { sub: string; email: string; role: Role };
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { profile: true },
    });
    if (!user || !user.isActive) {
      return fail(res, "UNAUTHORIZED", "Invalid or inactive user", 401);
    }
    req.user = {
      id: user.id,
      email: user.email,
      role: user.profile?.role ?? payload.role,
    };
    next();
  } catch {
    return fail(res, "UNAUTHORIZED", "Invalid or expired token", 401);
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return fail(res, "UNAUTHORIZED", "Authentication required", 401);
    }
    if (!roles.includes(req.user.role)) {
      return fail(res, "FORBIDDEN", "Insufficient permissions", 403);
    }
    next();
  };
}

export function validateBody<T>(schema: { parse: (data: unknown) => T }) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      next(new AppError("VALIDATION_ERROR", "Invalid request body", 400));
    }
  };
}
