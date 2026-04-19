"use strict";

const express = require("express");
const router = express.Router();
const db = require("../db");

// Login mit E-Mail + Passwort (plaintext - nicht sicher!)
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

// Registriert neuen Benutzer
router.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;

    // Überprüfen, ob alle erforderlichen Felder vorhanden sind
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
    // nach erfolgreicher Abfrage wird der neue Benutzer in die Datenbank eingefügt
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

// Ruft Profildaten ab
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
    
      // Antwort an das Backend mit den Profildaten des Benutzers
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

// Aktualisiert Profildaten (Username, Email, Passwort)
router.post('/profile/update', async (req, res) => {
  const { userId, username, email, neuesPassword } = req.body;

  if (!userId || !username || !email) {
    return res.status(400).json({ message: 'userId, username und email sind erforderlich' });
  }

  try {
    const [rows] = await db.execute('SELECT user_id FROM users WHERE user_id = ?', [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Benutzer nicht gefunden' });
    }

    if (neuesPassword) {
      await db.execute(
        'UPDATE users SET username = ?, email = ?, password = ? WHERE user_id = ?',
        [username, email, neuesPassword, userId]
      );
    } else {
      await db.execute(
        'UPDATE users SET username = ?, email = ? WHERE user_id = ?',
        [username, email, userId]
      );
    }

    res.json({ message: 'Profil erfolgreich aktualisiert' });
  } catch (error) {
    console.error('Fehler beim Aktualisieren des Profils im Backend:', error);
    res.status(500).json({ message: 'Interner Serverfehler' });
  }
});

// Löscht Benutzerkonto
router.post('/profile/delete', async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: 'userId ist erforderlich' });
  }

  try {
    const [rows] = await db.execute('SELECT user_id FROM users WHERE user_id = ?', [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Benutzer nicht gefunden' });
    }

    // Lösche den Benutzer aus der Datenbank
    await db.execute('DELETE FROM users WHERE user_id = ?', [userId]);

    res.json({ message: 'Profil erfolgreich gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen des Profils im Backend:', error);
    res.status(500).json({ message: 'Interner Serverfehler' });
  }
});

module.exports = router;
