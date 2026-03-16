'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db'); 


router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'E-Mail und Passwort sind erforderlich' });
  }

  try {
    const [rows] = await db.execute(
      'SELECT user_id, email, password FROM users WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'E-Mail oder Passwort falsch' });
    }

    const user = rows[0];

    if (user.password !== password) {
      return res.status(401).json({ message: 'E-Mail oder Passwort falsch' });
    }

    res.json({
      message: 'Login erfolgreich',
      user: {
        id: user.user_id,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Login-Fehler im Backend:', error);
    res.status(500).json({ message: 'Interner Serverfehler' });
  }
});

// Logik um einen neuen Benutzer zu registrieren
router.post('/signup', async (req, res) => {
  const { email, password } = req.body;

  //Überprüfen ob E-Mail und Passwort übergeben wurden
  if (!email || !password) {
    return res.status(400).json({ message: 'E-Mail und Passwort sind erforderlich' });
  }

  try {
    const [existingUser] = await db.execute(
      'SELECT user_id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({ message: 'E-Mail ist bereits registriert' });
    }
    
    const [result] = await db.execute(
      'INSERT INTO users (email, password) VALUES (?, ?)',
      [email, password]
    );

    const userId = result.insertId;

    res.status(201).json({
      message: 'Benutzer erfolgreich registriert',
      user: {
        id: userId,
        email: email
      }
    });

  } catch (error) {
    console.error('Registrierungsfehler im Backend:', error);
    res.status(500).json({ message: '' });
  }
});

module.exports = router;