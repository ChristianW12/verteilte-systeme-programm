'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const apiRoutes = require('./routes/api.routes');

const app = express();
const server = http.createServer(app);

// Socket.io Initialisierung (für spätere Echtzeit-Features)   
const io = new Server(server, {
    cors: {
        origin: "*", // Erlaubt dem Frontend den Zugriff
        methods: ["GET", "POST"]
    }
});

app.use(express.json());

app.use((req, res, next) => {
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
    console.log(`Neuer Client verbunden: ${socket.id}`);

    socket.on('disconnect', () => {
        console.log(`Client getrennt: ${socket.id}`);
    });
});

// Port-Konfiguration
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Minimal-Backend läuft auf http://localhost:${PORT}`);
    console.log(`Test-URL: http://localhost:${PORT}/health`);
});
