'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const mysql = require('mysql2/promise');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.json());

// CORS Header
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Redis Adapter für horizontale Skalierung
const redisHost = process.env.REDIS_HOST || 'redis';
const pubClient = createClient({ url: `redis://${redisHost}:6379` });
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    console.log('Redis Adapter für WebSockets aktiv');
});

// Datenbankverbindung (Pool)
const dbConfig = {
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
};

let db;
async function initDB() {
    db = await mysql.createPool(dbConfig);
}
initDB();

// --- WebSocket Events ---
io.on('connection', (socket) => {
    console.log('Ein Client hat sich verbunden:', socket.id);

    socket.on('disconnect', () => {
        console.log('Client getrennt:', socket.id);
    });
});

// --- REST Routen ---

// 1. Projekte laden
app.get('/projects', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM projects');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Aufgaben eines Projekts laden
app.get('/projects/:id/tasks', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM tasks WHERE project_id = ?', [req.params.id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Neue Aufgabe erstellen
app.post('/tasks', async (req, res) => {
    const { project_id, title, description, assigned_to, priority } = req.body;
    try {
        const [result] = await db.query(
            'INSERT INTO tasks (project_id, title, description, assigned_to, priority) VALUES (?, ?, ?, ?, ?)',
            [project_id, title, description, assigned_to, priority || 'Medium']
        );
        
        const newTask = { id: result.insertId, project_id, title, description, status: 'To Do' };
        
        // --- ECHTZEIT-UPDATE ---
        // Sende die neue Aufgabe an ALLE verbundenen Clients (über alle Backend-Instanzen hinweg)
        io.emit('task_created', newTask);
        
        res.status(201).json(newTask);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Status einer Aufgabe ändern
app.put('/tasks/:id/status', async (req, res) => {
    const { status } = req.body;
    try {
        await db.query('UPDATE tasks SET status = ? WHERE task_id = ?', [status, req.params.id]);
        
        // --- ECHTZEIT-UPDATE ---
        io.emit('task_updated', { id: req.params.id, status });
        
        res.json({ message: 'Status aktualisiert' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Server starten
const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend mit WebSockets läuft auf http://0.0.0.0:${PORT}`);
});
