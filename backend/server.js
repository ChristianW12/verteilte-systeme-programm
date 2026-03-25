'use strict';

const express = require('express');
const http = require('http');
const os = require('os');

const apiRoutes = require('./routes/api.routes');

const app = express();
const server = http.createServer(app);

// Server-Identifikation (Container-Name oder Hostname)
const SERVER_ID = os.hostname();
const SERVER_PORT = process.env.PORT || 3000;


app.use(express.json());

// Logging-Middleware: Zeigt welcher Server die Anfrage bearbeitet
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${SERVER_ID} | ${req.method} ${req.path}`);
    
    // Header für Frontend, damit es sieht, welcher Server antwortet
    res.setHeader('X-Served-By', SERVER_ID);
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // für den Fall das der Browser eine OPTIONS-Anfrage sendet (CORS Preflight)
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use('/api', apiRoutes);


// Port-Konfiguration
server.listen(SERVER_PORT, '0.0.0.0', () => {
    console.log(`========================================`);
    console.log(`Backend-Server läuft: ${SERVER_ID}`);
    console.log(`Port: ${SERVER_PORT}`);
    console.log(`Test-URL: http://localhost:8080/api/test`);
    console.log(`========================================`);
});
