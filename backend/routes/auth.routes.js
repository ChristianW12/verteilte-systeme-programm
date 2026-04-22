"use strict";

const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcryptjs");
const { randomBytes } = require("crypto");
const { authenticate } = require("../middleware/authenticate");
const {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REFRESH_TOKEN_TTL_DAYS,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  buildCookieOptions,
} = require("../auth/jwt");

const BCRYPT_ROUNDS = 10;
const ACCESS_COOKIE_MAX_AGE = 15 * 60 * 1000;
const REFRESH_COOKIE_MAX_AGE = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

let refreshTableReadyPromise = null;

function createRandomUserId() {
  // Erstellt kryptographisch zufällige, kollisionsarme String-ID für neue Benutzerkonten.
  return `usr_${randomBytes(12).toString("hex")}`;
}

async function ensureRefreshTokenTable() {
  // Erstellt Refresh-Token-Tabelle lazy beim ersten Zugriff, danach wiederverwendbare Promise.
  if (!refreshTableReadyPromise) {
    refreshTableReadyPromise = db.execute(`
      CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
        token_id INT AUTO_INCREMENT PRIMARY KEY,
        jti VARCHAR(128) NOT NULL UNIQUE,
        user_id VARCHAR(64) NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        revoked_at DATETIME NULL,
        replaced_by_jti VARCHAR(128) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_expires_at (expires_at),
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `);
  }
  await refreshTableReadyPromise;
}

async function revokeRefreshByJti(jti, replacedByJti = null) {
  // Markiert Refresh-Token als widerrufen und optional durch neues JTI ersetzt.
  if (!jti) return;
  await db.execute(
    `UPDATE auth_refresh_tokens
     SET revoked_at = COALESCE(revoked_at, NOW()),
         replaced_by_jti = COALESCE(?, replaced_by_jti)
     WHERE jti = ?`,
    [replacedByJti, jti],
  );
}

function setAuthCookies(res, accessToken, refreshToken) {
  // Schreibt Access- und Refresh-Token als sichere HttpOnly-Cookies in die Antwort.
  res.cookie(ACCESS_COOKIE, accessToken, buildCookieOptions(ACCESS_COOKIE_MAX_AGE));
  res.cookie(REFRESH_COOKIE, refreshToken, buildCookieOptions(REFRESH_COOKIE_MAX_AGE));
}

function clearAuthCookies(res) {
  // Entfernt Auth-Cookies zuverlässig, um Session auf Clientseite vollständig zu beenden.
  res.clearCookie(ACCESS_COOKIE, buildCookieOptions(0));
  res.clearCookie(REFRESH_COOKIE, buildCookieOptions(0));
}

async function issueSession(res, user) {
  // Erzeugt neue Token, persistiert Refresh-Hash und setzt beide Auth-Cookies atomar.
  await ensureRefreshTokenTable();

  const accessToken = signAccessToken(user);
  const refresh = signRefreshToken(user);
  const refreshHash = hashToken(refresh.token);

  await db.execute(
    `INSERT INTO auth_refresh_tokens (jti, user_id, token_hash, expires_at)
     VALUES (?, ?, ?, ?)`,
    [refresh.jti, user.userId, refreshHash, refresh.expiresAt],
  );

  setAuthCookies(res, accessToken, refresh.token);
}

// Login mit E-Mail + Passwort
router.post("/login", async (req, res) => {
  // Authentifiziert Credentials, erstellt Session-Tokens und liefert minimale User-Metadaten zurück.
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "E-Mail und Passwort sind erforderlich" });
  }

  try {
    const [rows] = await db.execute(
      "SELECT user_id, email, password FROM users WHERE email = ?",
      [email],
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "E-Mail oder Passwort falsch" });
    }

    const user = rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ message: "E-Mail oder Passwort falsch" });
    }

    await issueSession(res, {
      userId: String(user.user_id),
      email: String(user.email),
    });

    return res.json({
      message: "Login erfolgreich",
      user: {
        id: user.user_id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login-Fehler im Backend:", error);
    return res.status(500).json({ message: "Interner Serverfehler" });
  }
});

// Rotiert Access + Refresh Token
router.post("/refresh", async (req, res) => {
  // Prüft Refresh-Token, rotiert JTI und setzt frische Access/Refresh-Cookies.
  const refreshToken = String(req.cookies?.[REFRESH_COOKIE] || "").trim();
  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh Token fehlt" });
  }

  try {
    await ensureRefreshTokenTable();
    const payload = verifyRefreshToken(refreshToken);
    const currentJti = String(payload.jti || "");
    const userId = String(payload.sub || "");
    const refreshHash = hashToken(refreshToken);

    const [rows] = await db.execute(
      `SELECT jti, user_id, token_hash, expires_at, revoked_at
       FROM auth_refresh_tokens
       WHERE jti = ?`,
      [currentJti],
    );

    if (rows.length === 0) {
      clearAuthCookies(res);
      return res.status(401).json({ message: "Ungültiger Refresh Token" });
    }

    const tokenRow = rows[0];
    const isExpired = new Date(tokenRow.expires_at).getTime() <= Date.now();
    const isRevoked = tokenRow.revoked_at != null;
    if (
      isExpired ||
      isRevoked ||
      String(tokenRow.user_id) !== userId ||
      String(tokenRow.token_hash) !== refreshHash
    ) {
      await revokeRefreshByJti(currentJti);
      clearAuthCookies(res);
      return res.status(401).json({ message: "Ungültiger Refresh Token" });
    }

    const [userRows] = await db.execute(
      "SELECT user_id, email FROM users WHERE user_id = ?",
      [userId],
    );
    if (userRows.length === 0) {
      await revokeRefreshByJti(currentJti);
      clearAuthCookies(res);
      return res.status(401).json({ message: "Session nicht mehr gültig" });
    }

    const refreshNext = signRefreshToken({
      userId,
      email: userRows[0].email,
    });

    await db.execute(
      `INSERT INTO auth_refresh_tokens (jti, user_id, token_hash, expires_at)
       VALUES (?, ?, ?, ?)`,
      [refreshNext.jti, userId, hashToken(refreshNext.token), refreshNext.expiresAt],
    );
    await revokeRefreshByJti(currentJti, refreshNext.jti);

    const accessToken = signAccessToken({
      userId,
      email: userRows[0].email,
    });
    setAuthCookies(res, accessToken, refreshNext.token);
    return res.status(200).json({ message: "Session erneuert" });
  } catch (error) {
    clearAuthCookies(res);
    return res.status(401).json({ message: "Refresh fehlgeschlagen" });
  }
});

// Logout: Refresh Token revoken + Cookies löschen
router.post("/logout", async (req, res) => {
  // Widerruft vorhandenes Refresh-Token und löscht alle Auth-Cookies sofort.
  const refreshToken = String(req.cookies?.[REFRESH_COOKIE] || "").trim();
  if (refreshToken) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      await revokeRefreshByJti(String(payload.jti || ""));
    } catch (_error) {
      // Token ist bereits ungültig; Cookies werden trotzdem gelöscht.
    }
  }

  clearAuthCookies(res);
  return res.status(200).json({ message: "Logout erfolgreich" });
});

// Aktuelle Session prüfen
router.get("/session/me", authenticate, async (req, res) => {
  // Liefert eingeloggten Benutzer aus JWT-Kontext und validiert Existenz in Datenbank.
  try {
    const userId = String(req.auth?.userId || "").trim();
    const [rows] = await db.execute(
      "SELECT user_id, username, email, created_at FROM users WHERE user_id = ?",
      [userId],
    );

    if (rows.length === 0) {
      clearAuthCookies(res);
      return res.status(401).json({ message: "Session nicht mehr gültig" });
    }

    const user = rows[0];
    return res.status(200).json({
      user: {
        id: user.user_id,
        username: user.username,
        email: user.email,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error("Fehler bei session/me:", error);
    return res.status(500).json({ message: "Interner Serverfehler" });
  }
});

// Registriert neuen Benutzer
router.post("/signup", async (req, res) => {
  // Validiert Eingaben, hasht Passwort und legt neuen Benutzer in Datenbank an.
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ message: "Benutzername, E-Mail und Passwort sind erforderlich" });
  }

  if (username.length < 3 || username.length > 30) {
    return res
      .status(400)
      .json({ message: "Benutzername muss zwischen 3 und 30 Zeichen lang sein" });
  }

  if (email.length > 50) {
    return res
      .status(400)
      .json({ message: "E-Mail darf maximal 50 Zeichen lang sein" });
  }

  if (password.length < 8 || password.length > 100) {
    return res
      .status(400)
      .json({ message: "Passwort muss zwischen 8 und 100 Zeichen lang sein" });
  }

  try {
    const [existingUser] = await db.execute(
      "SELECT user_id FROM users WHERE email = ?",
      [email],
    );

    if (existingUser.length > 0) {
      return res
        .status(409)
        .json({ message: "E-Mail ist bereits registriert" });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const userId = createRandomUserId();
    await db.execute(
      "INSERT INTO users (user_id, username, email, password) VALUES (?, ?, ?, ?)",
      [userId, username, email, passwordHash],
    );

    return res.status(201).json({ message: "Registrierung erfolgreich" });
  } catch (error) {
    console.error("Registrierungsfehler im Backend:", error);
    return res.status(500).json({ message: "Interner Serverfehler" });
  }
});

// Ruft Profildaten ab (aus Auth-Session)
router.post("/profile", authenticate, async (req, res) => {
  // Liest Profildaten ausschließlich für aktuell authentifizierten Benutzer aus.
  const userId = String(req.auth?.userId || "").trim();

  try {
    const [rows] = await db.execute(
      "SELECT user_id, username, email, created_at FROM users WHERE user_id = ?",
      [userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Benutzer nicht gefunden" });
    }

    const user = rows[0];
    return res.json({
      user: {
        id: user.user_id,
        username: user.username,
        email: user.email,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error("Fehler beim Abrufen des Profils im Backend:", error);
    return res.status(500).json({ message: "Interner Serverfehler" });
  }
});

// Aktualisiert Profildaten (Username, Email, Passwort)
router.post("/profile/update", authenticate, async (req, res) => {
  // Aktualisiert Profilfelder des eingeloggten Benutzers, optional mit neuem Passwort-Hash.
  const { username, email, neuesPassword } = req.body;
  const userId = String(req.auth?.userId || "").trim();

  if (!userId || !username || !email) {
    return res.status(400).json({ message: "username und email sind erforderlich" });
  }

  try {
    const [rows] = await db.execute("SELECT user_id FROM users WHERE user_id = ?", [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "Benutzer nicht gefunden" });
    }

    if (neuesPassword) {
      const passwordHash = await bcrypt.hash(neuesPassword, BCRYPT_ROUNDS);
      await db.execute(
        "UPDATE users SET username = ?, email = ?, password = ? WHERE user_id = ?",
        [username, email, passwordHash, userId],
      );
    } else {
      await db.execute(
        "UPDATE users SET username = ?, email = ? WHERE user_id = ?",
        [username, email, userId],
      );
    }

    return res.json({ message: "Profil erfolgreich aktualisiert" });
  } catch (error) {
    console.error("Fehler beim Aktualisieren des Profils im Backend:", error);
    return res.status(500).json({ message: "Interner Serverfehler" });
  }
});

// Löscht Benutzerkonto
router.post("/profile/delete", authenticate, async (req, res) => {
  // Löscht authentifiziertes Benutzerkonto und invalidiert verbleibende Session-Cookies direkt.
  const userId = String(req.auth?.userId || "").trim();

  try {
    const [rows] = await db.execute("SELECT user_id FROM users WHERE user_id = ?", [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "Benutzer nicht gefunden" });
    }

    await db.execute("DELETE FROM users WHERE user_id = ?", [userId]);
    clearAuthCookies(res);
    return res.json({ message: "Profil erfolgreich gelöscht" });
  } catch (error) {
    console.error("Fehler beim Löschen des Profils im Backend:", error);
    return res.status(500).json({ message: "Interner Serverfehler" });
  }
});

module.exports = router;
