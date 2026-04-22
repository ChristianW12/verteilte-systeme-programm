'use strict';

const express = require('express');
const http = require('http');
const os = require('os');
const cookieParser = require('cookie-parser');

const apiRoutes = require('./routes/api.routes');

const app = express();
const server = http.createServer(app);

// Server-Hostname für Load-Balancer Monitoring
const SERVER_ID = os.hostname();
const SERVER_PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());

// Logging + CORS + Preflight-Handler
app.use((req, res, next) => {
    // Schreibt Request-Log und setzt CORS-Header inklusive Credential-Unterstützung für Cookies.
    console.log(`[${new Date().toISOString()}] ${SERVER_ID} | ${req.method} ${req.path}`);
    const requestOrigin = req.headers.origin;
    res.setHeader('X-Served-By', SERVER_ID);
    if (requestOrigin) {
        res.setHeader('Access-Control-Allow-Origin', requestOrigin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.use('/api', apiRoutes);

server.listen(SERVER_PORT, '0.0.0.0', () => {
    // Startet HTTP-Server und protokolliert Host, Port sowie Test-Endpoint zur Kontrolle.
    console.log(`========================================`);
    console.log(`Backend-Server läuft: ${SERVER_ID}`);
    console.log(`Port: ${SERVER_PORT}`);
    console.log(`Test-URL: http://localhost:8080/api/test`);
    console.log(`========================================`);
    console.log(`Anwendung läuft auf https://localhost:8080`)
    console.log(`========================================`);
});
