'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

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

// CORS Konfiguration für REST-Anfragen
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Ein einfacher Test-Endpunkt
app.get('/health', (req, res) => {
    res.json({ status: 'Backend läuft!', timestamp: new Date() });
});

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
