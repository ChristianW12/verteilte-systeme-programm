"use strict";

const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TTL || "15m";
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS || 7);
const JWT_ISSUER = process.env.JWT_ISSUER || "vstasks";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET fehlt oder ist zu kurz (mind. 32 Zeichen)");
  }
  return secret;
}

function buildCookieOptions(maxAgeMs) {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeMs,
  };
}

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user.userId),
      email: String(user.email || ""),
      type: "access",
    },
    getJwtSecret(),
    {
      issuer: JWT_ISSUER,
      expiresIn: ACCESS_TOKEN_TTL,
      jwtid: crypto.randomUUID(),
    },
  );
}

function signRefreshToken(user) {
  const token = jwt.sign(
    {
      sub: String(user.userId),
      email: String(user.email || ""),
      type: "refresh",
    },
    getJwtSecret(),
    {
      issuer: JWT_ISSUER,
      expiresIn: `${REFRESH_TOKEN_TTL_DAYS}d`,
      jwtid: crypto.randomUUID(),
    },
  );

  const decoded = jwt.decode(token);
  return {
    token,
    jti: decoded && typeof decoded === "object" ? String(decoded.jti || "") : "",
    expiresAt: decoded && typeof decoded === "object" && decoded.exp
      ? new Date(Number(decoded.exp) * 1000)
      : null,
  };
}

function verifyAccessToken(token) {
  const payload = jwt.verify(token, getJwtSecret(), { issuer: JWT_ISSUER });
  if (!payload || payload.type !== "access") {
    throw new Error("Ungültiger Access Token");
  }
  return payload;
}

function verifyRefreshToken(token) {
  const payload = jwt.verify(token, getJwtSecret(), { issuer: JWT_ISSUER });
  if (!payload || payload.type !== "refresh") {
    throw new Error("Ungültiger Refresh Token");
  }
  return payload;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REFRESH_TOKEN_TTL_DAYS,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  buildCookieOptions,
};
