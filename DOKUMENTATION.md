# Code Dokumentation - Kurze Übersicht

## Backend

### server.js
- `SERVER_ID`: Hostname für Load-Balancer Monitoring
- Middleware: Logging + CORS + Preflight-Handling für alle Routes

### db.js
- MySQL Connection Pool mit max. 10 gleichzeitigen Verbindungen

### realtime.publisher.js
- `getClient()`: Singleton-Pattern für Redis Verbindung
- `publishEvent()`: Publiziert Events über Redis Pub/Sub zu WebSocket-Clients

### routes/api.routes.js
- `GET /api/test`: Health-Check für Monitoring
- Sub-Router für auth, tasks, projects

### routes/auth.routes.js
- `POST /login`: Authentifizierung mit E-Mail/Passwort
- `POST /session/validate`: Validiert `userId` + `passwordHash` gegen DB-Stand
- `POST /signup`: Benutzer-Registrierung
- `POST /profile`: Profildaten abrufen
- `POST /profile/update`: Username, Email, Passwort ändern
- `POST /profile/delete`: Benutzerkonto löschen

### routes/task.routes.js

**Lock-Management (Concurrency Control):**
- `POST /lock/acquire`: Sperrt Task für exklusiven Zugriff (HTTP 423 wenn bereits gesperrt)
- `POST /lock/heartbeat`: Verlängert Lock-TTL (120 Sekunden)
- `POST /lock/release`: Gibt Lock frei

**Task CRUD:**
- `POST /create`: Erstellt neue Task (mit Validierung und Berechtigungsprüfung)
- `POST /edit`: Bearbeitet Task-Felder
- `POST /edit/updateStatus`: Ändert Status + gibt Lock frei
- `POST /delete`: Löscht Task
- `GET /:id`: Ruft einzelne Task ab
- `GET /project/:projectId`: Alle Tasks eines Projekts
- `GET /:id/assignees`: Mögliche Assignees (Admin/Developer)

### routes/project.routes.js

**Projekt-Verwaltung:**
- `POST /create`: Erstellt Projekt mit Mitgliedern (transaktional)
- `POST /edit`: Bearbeitet Projekt + Mitgliederverwaltung mit Diff-Berechnung
- `POST /delete`: Löscht nur wenn Ersteller (Owner)
- `GET /get/:userId`: Alle Projekte eines Users mit Mitgliederlisten
- `GET /:projectId/assignees`: Admin/Developer eines Projekts
- `GET /:projectId/statistics`: Task-Zähler nach Status

**Member-Management:**
- `GET /member-search`: Email-Suche für Mitgliederverwaltung (LIKE, max 8 Ergebnisse)

---

## WebSocket / Realtime

### websockets/index.js
- Verbindung: WebSocket Server auf Port 4000, Path `/ws`
- `broadcast()`: Sendet Event an alle verbundenen Clients
- `startRedisBridge()`: Redis Subscriber abonniert `realtime.events` Channel und broadcastet Nachrichten

**Event-Flow:**  
Backend → Redis Pub/Sub → WebSocket Server → Broadcast an alle Clients

---

## Frontend

### shared/services/realtime.ts

- `connect()`: Stellt WebSocket-Verbindung her (wss:// für HTTPS, ws:// für HTTP)
- `refreshRequired` Signal: Wird true bei task/project-Events
- `lastEvent` Signal: Speichert letztes erhaltenes Event
- `attemptReconnect()`: Exponentielle Backoff-Strategie (max 30s, 5 Versuche)
- `disconnect()`: Trennt WebSocket-Verbindung

**Trigger für Refresh:**  
- task.created, task.deleted, task.updated, task.statusUpdated
- project.created, project.updated

---

## Authentifizierung & Autorisierung

### Berechtigungsmodell
- **Admin**: Vollzugriff auf Projekt + kann Mitglieder verwalten
- **Developer**: Kann nur seine eigenen Tasks bearbeiten + bearbeiten lesen
- **Viewer**: Nur Lesezugriff

### Task-Locks (Pessimistic Locking)
- Redis Key: `lock:task:{taskId}`
- TTL: 120 Sekunden
- Heartbeat erneuert Lock alle 30 Sekunden
- HTTP 423 wenn von anderem User gesperrt

### Session-Management
- **Frontend-seitig**: sessionStorage speichert `isLoggedIn`, `userId`, `userEmail`, `passwordHash`
- **Route-Guard**: `auth.guard.ts` validiert Session per `/api/auth/session/validate`
- **Kein JWT**: Einfache Session-Verwaltung für Demo
- Keine Token-Validierung pro Request

---

## Fehler-Codes

| Code | Bedeutung |
|------|-----------|
| 200 | OK |
| 201 | Erstellt |
| 400 | Ungültige Parameter |
| 401 | Authentifizierung fehlgeschlagen |
| 403 | Keine Berechtigung |
| 404 | Nicht gefunden |
| 409 | Konflikt (z.B. Email schon registriert) |
| 423 | Gesperrt (Task-Lock aktiv) |
| 500 | Serverfehler |

---

## Wichtige Design-Patterns

1. **Singleton Pattern** (Redis): `getClient()`
2. **Pessimistic Locking**: Redis für Task-Sperren
3. **Event-Driven**: Pub/Sub für Realtime-Updates
4. **Transaktionale Operations**: DB Transactions bei Projekt-Erstellung/-Bearbeitung
5. **Exponentieller Backoff**: WebSocket Reconnect

---

## TODOs / Sicherheitshinweise

⚠️ **Session-Hardening**: Frontend-Session wird im Guard serverseitig validiert, aber viele API-Endpunkte vertrauen weiterhin `user_id` aus dem Request  
⚠️ **JWT**: Keine Token-Authentifizierung, nur sessionStorage  
⚠️ **Duplikat-Check**: Profile/update prüft nicht auf Email-Duplikate  
⚠️ **Input-Validierung**: Könnte erweitert werden (SQL Injection ist aber durch Prepared Statements geschützt)

