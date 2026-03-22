'use strict';

const express = require('express');
const os = require('os');
const authRoutes = require('./auth.routes');
const taskRoutes = require('./task.routes');
const projectRoutes = require('./project.routes'); 

const router = express.Router();

// Schneller Health-Check für Reverse-Proxy-/API-Tests
router.get('/test', (req, res) => {
    res.status(200).json({ 
        message: 'aufruf war erfolgreich',
        server: os.hostname(),
        timestamp: new Date().toISOString()
    });
});

// Sub-Route für alles rund ums Login, Registrierung, etc.
router.use('/auth', authRoutes);

// Sub-Route für alles rund um die Tasks
router.use('/tasks', taskRoutes);

// Sub-Route für alles rund um die Projekte
router.use('/project', projectRoutes);

module.exports = router;