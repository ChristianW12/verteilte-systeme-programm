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

module.exports = router;