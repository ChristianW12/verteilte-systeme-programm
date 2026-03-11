'use strict';

const express = require('express');
const authRoutes = require('./auth.routes');

const router = express.Router();

// Sub-Routes nach Domänen bündeln
router.use('/auth', authRoutes);

module.exports = router;
