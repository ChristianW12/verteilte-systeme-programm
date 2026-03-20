"use strict";

const express = require("express");
const router = express.Router();
const db = require("../db");

router.post("/login", async (req, res) => {
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

    if (user.password !== password) {
      return res.status(401).json({ message: "E-Mail oder Passwort falsch" });
    }

    let userId = user.user_id;
    let userEmail = user.email;

    res.json({
      message: "Login erfolgreich",
      user: {
        id: userId,
        email: userEmail,
      },
    });
  } catch (error) {
    console.error("Login-Fehler im Backend:", error);
    res.status(500).json({ message: "Interner Serverfehler" });
  }
});

router.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ message: "Benutzername, E-Mail und Passwort sind erforderlich" });
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

    await db.execute(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, password],
    );

    res.status(201).json({ message: "Registrierung erfolgreich" });
  } catch (error) {
    console.error("Registrierungsfehler im Backend:", error);
    res.status(500).json({ message: "Interner Serverfehler" });
  }
});

router.post('/profile', async (req, res) => {
  const {userId} = req.body;
  
  if (!userId) {
    return res.status(400).json({message: "Benutzer-ID ist erforderlich"});
  }

  try {
    const [rows] = await db.execute(
      "SELECT user_id, username, email, created_at, password FROM users WHERE user_id = ?",
      [userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({message: "Benutzer nicht gefunden"});
    }

    const user = rows[0];
    res.json({
      user: {
        id: user.user_id,
        username: user.username,
        email: user.email,
        createdAt: user.created_at,
        password: user.password,
      },
    });
  } catch (error) {
    console.error("Fehler beim Abrufen des Profils im Backend:", error);
    res.status(500).json({message: "Interner Serverfehler"});
  }
});

module.exports = router;
