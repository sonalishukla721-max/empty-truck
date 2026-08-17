import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Role } from "@prisma/client";
import { prisma } from "../config/database.js";
import { config } from "../config/index.js";
import { AppError } from "../utils/response.js";

function signAccessToken(userId: string, email: string, role: Role) {
  return jwt.sign({ sub: userId, email, role }, config.jwt.secret, {
    expiresIn: config.jwt.accessExpires as jwt.SignOptions["expiresIn"],
  });
}

function signRefreshToken(userId: string) {
  return jwt.sign({ sub: userId }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpires as jwt.SignOptions["expiresIn"],
  });
}

export async function register(data: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role: Role;
  language?: string;
  companyName?: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new AppError("EMAIL_EXISTS", "Email already registered", 409);

  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      profile: {
        create: {
          fullName: data.fullName,
          phone: data.phone,
          email: data.email,
          role: data.role,
          language: data.language ?? "en",
        },
      },
      userRoles: { create: { role: data.role } },
      ...(data.role === "DRIVER"
        ? {
            driver: {
              create: {
                name: data.fullName,
                phone: data.phone,
                language: data.language ?? "hi",
              },
            },
          }
        : {}),
      ...(data.role === "SHIPPER"
        ? {
            shipper: {
              create: {
                companyName: data.companyName ?? data.fullName,
                phone: data.phone,
                contactPerson: data.fullName,
              },
            },
          }
        : {}),
    },
    include: { profile: true, driver: true, shipper: true },
  });

  const accessToken = signAccessToken(user.id, user.email, data.role);
  const refreshToken = signRefreshToken(user.id);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { userId: user.id, token: refreshToken, expiresAt } });

  return { user: formatUser(user), accessToken, refreshToken };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { profile: true, driver: true, shipper: true },
  });
  if (!user || !user.isActive) throw new AppError("INVALID_CREDENTIALS", "Invalid email or password", 401);

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError("INVALID_CREDENTIALS", "Invalid email or password", 401);

  const role = user.profile?.role ?? "DRIVER";
  const accessToken = signAccessToken(user.id, user.email, role);
  const refreshToken = signRefreshToken(user.id);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { userId: user.id, token: refreshToken, expiresAt } });

  return { user: formatUser(user), accessToken, refreshToken };
}

export async function refresh(refreshToken: string) {
  try {
    const payload = jwt.verify(refreshToken, config.jwt.refreshSecret) as { sub: string };
    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date()) {
      throw new AppError("INVALID_TOKEN", "Refresh token expired", 401);
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { profile: true, driver: true, shipper: true },
    });
    if (!user) throw new AppError("INVALID_TOKEN", "User not found", 401);
    const role = user.profile?.role ?? "DRIVER";
    const accessToken = signAccessToken(user.id, user.email, role);
    return { accessToken, user: formatUser(user) };
  } catch {
    throw new AppError("INVALID_TOKEN", "Invalid refresh token", 401);
  }
}

export async function logout(refreshToken: string) {
  await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, driver: true, shipper: true, userRoles: true },
  });
  if (!user) throw new AppError("NOT_FOUND", "User not found", 404);
  return formatUser(user);
}

export async function updateProfile(
  userId: string,
  data: Partial<{ fullName: string; phone: string; language: string; city: string; state: string; address: string; avatarUrl: string }>,
) {
  const profile = await prisma.profile.update({
    where: { userId },
    data,
  });
  if (data.fullName || data.phone) {
    const driver = await prisma.driver.findUnique({ where: { userId } });
    if (driver) {
      await prisma.driver.update({
        where: { userId },
        data: { name: data.fullName ?? driver.name, phone: data.phone ?? driver.phone },
      });
    }
    const shipper = await prisma.shipper.findUnique({ where: { userId } });
    if (shipper) {
      await prisma.shipper.update({
        where: { userId },
        data: { contactPerson: data.fullName ?? shipper.contactPerson, phone: data.phone ?? shipper.phone },
      });
    }
  }
  return profile;
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { message: "If the email exists, a reset link will be sent" };
  const token = crypto.randomBytes(32).toString("hex");
  // In production, store token and send email. Demo mode returns token.
  return {
    message: "If the email exists, a reset link will be sent",
    ...(config.demo.mode ? { resetToken: token } : {}),
  };
}

export async function resetPassword(_token: string, _newPassword: string) {
  // Demo implementation - in production validate stored token
  throw new AppError("NOT_IMPLEMENTED", "Use forgot password flow in demo mode", 501);
}

function formatUser(user: {
  id: string;
  email: string;
  profile: { fullName: string; phone: string | null; role: Role; language: string; avatarUrl: string | null } | null;
  driver: { id: string } | null;
  shipper: { id: string } | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.profile?.fullName,
    phone: user.profile?.phone,
    role: user.profile?.role,
    language: user.profile?.language,
    avatar_url: user.profile?.avatarUrl,
    driver_id: user.driver?.id,
    shipper_id: user.shipper?.id,
  };
}
