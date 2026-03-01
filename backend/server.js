'use strict';

const express = require('express');
const mysql = require('mysql2');

const app = express();
app.use(express.json());

// Erlaubt Anfragen vom Frontend (CORS)
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Datenbankverbindung (Pool)
const db = mysql.createPool({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// --- Routen ---

// GET /items – alle Einträge laden
app.get('/items', (req, res) => {
    db.query('SELECT * FROM items', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// POST /items – neuen Eintrag anlegen
app.post('/items', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: '"name" fehlt' });
    db.query('INSERT INTO items (name) VALUES (?)', [name], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: result.insertId, name });
    });
});

// DELETE /items/:id – Eintrag löschen
app.delete('/items/:id', (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Ungültige ID' });
    db.query('DELETE FROM items WHERE id = ?', [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Gelöscht' });
    });
});

// Server starten
const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend läuft auf http://0.0.0.0:${PORT}`);
});
