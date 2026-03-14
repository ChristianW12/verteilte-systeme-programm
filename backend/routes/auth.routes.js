'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db'); // Import der Datenbankverbindung

// Platzhalter-Endpunkt zum Testen der Struktur
router.get('/health', (req, res) => {
  res.json({ status: 'auth route ok' });
});

/**
 * Login-Endpunkt
 * Prüft E-Mail und Passwort gegen die Datenbank
 * Erwartet: { email, password }
 * Antwortet: { message, user: { id, email } }
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'E-Mail und Passwort sind erforderlich' });
  }

  try {
    // 1. Suche den User in der Datenbank (nach E-Mail)
    const [rows] = await db.execute(
      'SELECT user_id, email, password FROM users WHERE email = ?',
      [email]
    );

    // 2. Prüfen, ob ein User gefunden wurde
    if (rows.length === 0) {
      return res.status(401).json({ message: 'E-Mail oder Passwort falsch' });
    }

    const user = rows[0];

    // 3. Passwort-Vergleich (im Klartext gemäß init.sql Testdaten)
    if (user.password !== password) {
      return res.status(401).json({ message: 'E-Mail oder Passwort falsch' });
    }

    // 4. Erfolg: Sende genau die Struktur zurück, die das Frontend erwartet
    res.json({
      message: 'Login erfolgreich',
      user: {
        id: user.user_id, // Mappt "user_id" aus DB auf "id" für das Frontend
        email: user.email
      }
    });

  } catch (error) {
    console.error('Login-Fehler im Backend:', error);
    res.status(500).json({ message: 'Interner Serverfehler' });
  }
});

module.exports = router;