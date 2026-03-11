'use strict';

const express = require('express');
const router = express.Router();

// Platzhalter-Endpunkt zum Testen der Struktur
router.get('/health', (req, res) => {
  res.json({ status: 'auth route ok' });
});

// Später: router.post('/login', ...)

module.exports = router;