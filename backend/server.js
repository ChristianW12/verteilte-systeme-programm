'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');

const apiRoutes = require('./routes/api.routes');

const app = express();
const server = http.createServer(app);

// Server-Identifikation (Container-Name oder Hostname)
const SERVER_ID = os.hostname();
const SERVER_PORT = process.env.PORT || 3000;

// Socket.io Initialisierung (für spätere Echtzeit-Features)   
const io = new Server(server, {
    cors: {
        origin: "*", // Erlaubt dem Frontend den Zugriff
        methods: ["GET", "POST"]
    }
});

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

// WebSocket Basis-Events
io.on('connection', (socket) => {
    console.log(`[${new Date().toISOString()}] ${SERVER_ID} | WebSocket-Client verbunden: ${socket.id}`);

    socket.on('disconnect', () => {
        console.log(`[${new Date().toISOString()}] ${SERVER_ID} | WebSocket-Client getrennt: ${socket.id}`);
    });
});

// Port-Konfiguration
server.listen(SERVER_PORT, '0.0.0.0', () => {
    console.log(`========================================`);
    console.log(`Backend-Server läuft: ${SERVER_ID}`);
    console.log(`Port: ${SERVER_PORT}`);
    console.log(`Test-URL: http://localhost:8080/api/test`);
    console.log(`========================================`);
});
