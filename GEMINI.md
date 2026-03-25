# Verteiltes Aufgaben- und Projektmanagementsystem

## Zielsetzung

Im Rahmen des Moduls **Verteilte Systeme** wird eine webbasierte Anwendung zur Aufgaben- und Projektverwaltung entwickelt.  
Ziel des Projekts ist es, zentrale Konzepte verteilter Systeme wie horizontale Skalierbarkeit, Lastverteilung und Ausfallsicherheit praxisnah umzusetzen und demonstrierbar zu machen.

## Projektidee

Die Anwendung orientiert sich funktional an etablierten Projektmanagement-Tools wie Jira und stellt grundlegende Features zur Organisation und Verwaltung von Projekten und Aufgaben bereit.  
Der Fokus liegt dabei nicht auf einem vollständigen Funktionsumfang, sondern auf einer technisch sauberen und skalierbaren Architektur.

## Funktionale Anforderungen

Die Anwendung soll folgende Kernfunktionen bereitstellen:

- Verwaltung von Projekten  
- Erstellung und Bearbeitung von Tickets (Issues)  
- Status-Workflow (z. B. To Do, In Progress, Done)  
- Priorisierung von Aufgaben  
- Benutzer- und Rollenverwaltung  
- Zuweisung von Tickets zu Nutzern  
- Kommentarfunktion pro Ticket  
- Verwaltung von Deadlines  

## Technisches Konzept

Die Anwendung basiert auf einer containerisierten Architektur unter Verwendung von Docker.

Geplante Struktur:

- Angular-Frontend zur Benutzerinteraktion  
- Express-Backend als REST-API  
- Relationale Datenbank zur persistenten Speicherung  
- Mehrere Backend-Instanzen zur Demonstration horizontaler Skalierung  
- Load Balancer zur Verteilung eingehender Anfragen  

Durch diese Architektur wird demonstriert, wie mehrere Backend-Instanzen parallel betrieben werden können und wie das System bei Ausfall einzelner Instanzen weiterhin funktionsfähig bleibt.

## Projektschwerpunkt

Der Fokus des Projekts liegt insbesondere auf:

- Trennung von Zuständigkeiten (Separation of Concerns)  
- Zustandslosen Services (Stateless Design)  
- Lastverteilung  
- Fehlertoleranz  

Die Anwendung dient als praxisnahes Demonstrationssystem zur Veranschaulichung zentraler Konzepte verteilter Systeme.


## Verbote für die AI Agents

- Keine eigenen Worktrees erstellen ohne Aufforderung. Immer auf den aktuellen Branch etwas commiten und beim commiten auf den Main Branch soll aus Sicherheitsgründen nachgefragt werden, ob der User sich sicher ist. 


***

## Plan: Task Locking and Realtime Sync

Wir setzen eine zentrale Realtime-Architektur um, in der das Backend fachliche Entscheidungen trifft, Redis Locks + Event-Channel hält und ein dedizierter WebSocket-Container Events an alle Frontends verteilt. Damit werden Task-Locks beim Öffnen einer Task, Locks beim Drag-and-Drop-Statuswechsel und Live-Refresh bei neuen Projekten/Tasks konsistent für alle Clients umgesetzt.

**Steps**
1. Phase 1: Infrastruktur und Event-Bus aufbauen.
2. Phase 2: Backend-Locking und Event-Publishing implementieren.
3. Phase 3: Frontend-Lock-UI, Interaktionssperren und Realtime-Refresh einbauen.
4. Phase 4: End-to-End Tests mit zwei Usern und mehreren Browser-Tabs absichern.

**Relevant files**
- [docker-compose.yaml](docker-compose.yaml) — dedizierten websockets-Service ergänzen und Redis-Umgebung konsistent halten
- [nginx/nginx.conf](nginx/nginx.conf) — /ws Routing mit Upgrade-Headern ergänzen
- [websockets/package.json](websockets/package.json) — Laufzeitabhängigkeiten und Startskripte
- [websockets/index.js](websockets/index.js) — Redis Subscriber und Broadcast-Server
- [websockets/Dockerfile](websockets/Dockerfile) — Container-Build für WebSocket-Service
- [backend/server.js](backend/server.js) — direkte Socket.io-Clientkopplung entfernen, Backend als Event-Producer belassen
- [backend/routes/task.routes.js](backend/routes/task.routes.js) — Lock-Endpoints + Schutz in Edit/Delete/Status-Pfaden
- [backend/routes/project.routes.js](backend/routes/project.routes.js) — Events bei Projektänderungen
- [backend/routes/api.routes.js](backend/routes/api.routes.js) — neue Lock-Endpoints verfügbar machen
- [frontend/frontend-app/src/app/app.config.ts](frontend/frontend-app/src/app/app.config.ts) — Realtime-Service global bereitstellen
- [frontend/frontend-app/src/app/pages/dashboard/dashboard.ts](frontend/frontend-app/src/app/pages/dashboard/dashboard.ts) — Task-Lock Zustand anzeigen, DnD blockieren, Refresh triggern
- [frontend/frontend-app/src/app/pages/detailed-task/detailed-task.ts](frontend/frontend-app/src/app/pages/detailed-task/detailed-task.ts) — Lock beim Öffnen setzen, Heartbeat, Release beim Verlassen
- [frontend/frontend-app/src/app/pages/create-project/create-project.ts](frontend/frontend-app/src/app/pages/create-project/create-project.ts) — optional lokalen Refresh-Hinweis nach Erstellung koordinieren

**Verification**
1. Zwei Nutzer öffnen dieselbe Task: nur ein Nutzer erhält Lock, anderer sieht gesperrt + user_mail.
2. Drag-and-Drop auf gelockter Task wird bei allen Nicht-Ownern blockiert.
3. Nach Save oder Statuswechsel wird Lock entfernt und Task wieder freigegeben.
4. Bei Projekt/Task-Neuerstellung erhalten betroffene Nutzer sofort Realtime-Refresh-Hinweis ohne manuellen Reload.

**Decisions**
- Redis ist Source of Truth für volatile Locks.
- Lock-Entscheidungen sind ausschließlich backend-seitig autoritativ.
- WebSocket-Container verteilt nur Events, enthält keine Business-Entscheidungen.

## Plan: Phase 1 Infrastructure and Contracts

WebSocket-Traffic wird aus dem Backend ausgelagert und über einen dedizierten Container betrieben, der Redis Pub/Sub als Eingang nutzt.

**Steps**
1. [websockets/index.js](websockets/index.js) erstellen: ws Server auf /ws, Redis Subscribe auf realtime.events, Broadcast an alle verbundenen Clients.
2. [websockets/Dockerfile](websockets/Dockerfile) erstellen: Node Alpine, npm install, Port 4000, npm start.
3. [docker-compose.yaml](docker-compose.yaml) erweitern: websockets-Service mit REDIS_HOST, REDIS_PORT, REDIS_CHANNEL, depends_on redis.
4. [nginx/nginx.conf](nginx/nginx.conf) erweitern: websocket_pool und location /ws mit Upgrade/Connection Headern.
5. Event-Vertrag festlegen: type, payload, timestamp, source(optional), correlation_id(optional).

**Verification**
1. docker compose config ohne Fehler.
2. WebSocket-Verbindung über /ws funktioniert durch den Reverse Proxy.
3. Test-Publish auf Redis wird als Nachricht bei verbundenen Clients sichtbar.

**Decisions**
- WebSocket-Endpunkt bleibt unter derselben Origin über /ws.
- Ein zentraler Redis-Channel realtime.events startet als MVP, projektbezogene Channels optional später.

## Plan: Phase 2 Backend Locking and Publishing

Backend implementiert atomare Locks in Redis und publisht alle relevanten Zustandswechsel als Realtime-Events.

**Steps**
1. Redis Publisher Modul ergänzen, das publishEvent zentral kapselt.
2. Lock-Datenmodell definieren: task_id, user_id, user_mail, locked_at, expires_at, lock_type, lock_token.
3. In [backend/routes/task.routes.js](backend/routes/task.routes.js) neue Endpoints ergänzen:
4. POST /api/tasks/lock/acquire setzt Lock atomar nur wenn frei.
5. POST /api/tasks/lock/heartbeat verlängert TTL für aktiven Lock-Owner.
6. POST /api/tasks/lock/release entfernt Lock nur für Lock-Owner.
7. GET /api/tasks/lock/state/:taskId liefert aktuellen Lockzustand.
8. Bestehende Endpoints absichern: Edit/Delete/Status nur wenn Lock-Regeln erfüllt.
9. Nach erfolgreichem Create/Edit/Delete/Status Events publizieren: task.created, task.updated, task.deleted, task.statusUpdated.
10. In [backend/routes/project.routes.js](backend/routes/project.routes.js) project.created und project.updated publizieren.
11. Für Requirement 3 zusätzlich frontend.refresh.required Event publizieren mit affected_user_ids und scope.

**Verification**
1. Gleichzeitige lock/acquire Requests erzeugen genau einen Gewinner.
2. Lock blockiert fremde Edit/Delete/Status Requests mit konsistentem Fehlerstatus.
3. Release nach Save/Statuswechsel entfernt Lock zuverlässig.
4. TTL und Heartbeat verhindern hängenbleibende Locks.

**Decisions**
- Konfliktcode für bestehendes Lock: 423 Locked.
- Lock-TTL Startwert: 120s, Heartbeat alle 30s.
- Publish immer nach erfolgreicher DB-Änderung.

## Plan: Phase 3 Frontend UX and Realtime Behavior

Frontend zeigt Lock-Zustände sichtbar an, blockiert unerlaubte Aktionen und reloaded Daten gezielt bei Realtime-Events.

**Steps**
1. Realtime-Service im Frontend ergänzen und in [frontend/frontend-app/src/app/app.config.ts](frontend/frontend-app/src/app/app.config.ts) registrieren.
2. In [frontend/frontend-app/src/app/pages/detailed-task/detailed-task.ts](frontend/frontend-app/src/app/pages/detailed-task/detailed-task.ts) beim Öffnen lock/acquire senden.
3. In [frontend/frontend-app/src/app/pages/detailed-task/detailed-task.ts](frontend/frontend-app/src/app/pages/detailed-task/detailed-task.ts) Heartbeat starten und bei Navigation/Destroy lock/release senden.
4. In [frontend/frontend-app/src/app/pages/dashboard/dashboard.ts](frontend/frontend-app/src/app/pages/dashboard/dashboard.ts) Lock-State-Map führen und Task-Karten ausgegraut markieren.
5. In [frontend/frontend-app/src/app/pages/dashboard/dashboard.ts](frontend/frontend-app/src/app/pages/dashboard/dashboard.ts) Drag-and-Drop bei fremdem Lock unterbinden.
6. Vor lokalem Statuswechsel zunächst lock/acquire lock_type=status_change durchführen.
7. Nach erfolgreichem oder fehlgeschlagenem Statuswechsel lock/release sicher ausführen.
8. Bei Events task.locked/task.unlocked UI sofort aktualisieren.
9. Bei frontend.refresh.required oder project.created/task.created vorhandene Select-Abfragen erneut ausführen.
10. In [frontend/frontend-app/src/app/pages/create-project/create-project.ts](frontend/frontend-app/src/app/pages/create-project/create-project.ts) nach Erfolgsnavigation auf Dashboard auf Realtime-Refresh vertrauen, keine manuelle Polling-Logik nötig.

**Verification**
1. Dashboard zeigt gesperrte Tasks inklusive Hinweis wird bearbeitet von user_mail.
2. Nicht-Owner kann keine gesperrte Task bearbeiten oder per DnD verschieben.
3. Owner kann bearbeiten, andere sehen Updates live.
4. Nach Lock-Release wird UI automatisch entsperrt.

**Decisions**
- UI-Feedback priorisieren: klare Sperrkennzeichnung vor stiller Fehlermeldung.
- Bei Event-Konflikten bevorzugt Frontend serverseitige Wahrheit und führt gezielten Refetch aus.

## Plan: Phase 4 Testing and Rollout

Die Umsetzung wird mit realistischen Multi-User-Szenarien getestet, bevor sie als stabil gilt.

**Steps**
1. Zwei Browserprofile mit zwei verschiedenen Usern parallel nutzen.
2. Szenario A: Task öffnen -> Lock sichtbar auf beiden Dashboards.
3. Szenario B: Fremder User versucht Edit oder DnD -> muss blockiert werden.
4. Szenario C: Owner speichert Änderung -> Lock entfernt, alle sehen neuen Zustand.
5. Szenario D: Neues Projekt mit Mitgliedern erstellen -> betroffene Mitglieder erhalten Refresh-Event.
6. Szenario E: Browser/Tab abrupt schließen -> TTL/Heartbeat Verhalten prüfen.

**Verification**
1. Keine dauerhaft hängenden Locks nach Abbruch.
2. Keine inkonsistenten Zustände zwischen zwei Clients.
3. Realtime-Events kommen auch bei mehreren Backend-Instanzen stabil an.

**Further Considerations**
1. Optional später projektbezogene WS-Rooms ergänzen, um Broadcasts effizienter zu machen.
2. Optional Audit-Log für Lock-Historie in DB ergänzen, falls fachlich gefordert.
