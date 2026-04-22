"use strict";

const { ACCESS_COOKIE, verifyAccessToken } = require("../auth/jwt");

function authenticate(req, res, next) {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) {
    return res.status(401).json({ message: "Nicht authentifiziert" });
  }

  try {
    const payload = verifyAccessToken(token);
    req.auth = {
      userId: String(payload.sub || ""),
      email: String(payload.email || ""),
      jti: String(payload.jti || ""),
    };
    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Ungültige Session" });
  }
}

module.exports = { authenticate };
