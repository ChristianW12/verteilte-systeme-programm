-- Erstellen der Tabellen für Jira 2.0

-- 1. Benutzer (Users)
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Projekte (Projects)
CREATE TABLE IF NOT EXISTS projects (
    project_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT default null,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- 3. Aufgaben (Tasks/Issues)
CREATE TABLE IF NOT EXISTS tasks (
    task_id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    assigned_to INT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status ENUM('To Do', 'In Progress', 'Done', 'Blocked') DEFAULT 'To Do',
    priority ENUM('Low', 'Medium', 'High') DEFAULT 'Medium',
    deadline DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- 4. Kommentare (Comments)
CREATE TABLE IF NOT EXISTS comments (
    comment_id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    user_id INT NOT NULL,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 5. Projektmitglieder (Project Members)
CREATE TABLE IF NOT EXISTS project_members (
    member_id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('Developer', 'Admin', 'Viewer') DEFAULT 'Viewer',
    added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_project_user (project_id, user_id),
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Testdaten

-- Benutzer
INSERT INTO users (username, email, password) VALUES
('christian', 'christian@example.com', 'PasswortChristian123'),
('alex', 'alex@example.com', 'PasswortAlex123'),
('melina', 'melina@example.com', 'PasswortMelina123'),
('luca', 'luca@example.com', 'PasswortLuca123');

-- Projekte
INSERT INTO projects (name, description , created_by) VALUES 
('Verteilte Systeme Projekt', 'Entwicklung einer skalierbaren Jira-Alternative mit Docker und Node.js.', 1),
('Frontend Redesign', 'Modernisierung der Benutzeroberfläche auf Basis von Angular 19.', 1);

-- Projektmitglieder zuweisen
INSERT INTO project_members (project_id, user_id, role) VALUES 
(1, 1, 'Admin'),
(1, 2, 'Developer'),
(1, 3, 'Developer'),
(2, 1, 'Admin'),
(2, 3, 'Developer'),
(2, 2, 'Viewer');

-- Aufgaben für Projekt 1
INSERT INTO tasks (project_id, title, description, status, assigned_to, created_by) VALUES 
(1, 'Datenbank aufsetzen', 'Tabellenstruktur in init.sql definieren und Constraints prüfen.', 'Done', 2, 1),
(1, 'Backend API implementieren', 'REST Endpoints für Projekte und Tasks erstellen.', 'In Progress', 2, 1),
(1, 'Dockerisierung', 'Dockerfile und docker-compose.yaml für das gesamte System erstellen.', 'To Do', 3, 1),
(1, 'Load Balancer konfigurieren', 'Nginx für horizontales Skalieren der Backend-Instanzen einrichten.', 'To Do', 1, 1);

-- Aufgaben für Projekt 2
INSERT INTO tasks (project_id, title, description, status, assigned_to, created_by) VALUES 
(2, 'Landing Page erstellen', 'Neues Dashboard-Design mit Angular Komponenten umsetzen.', 'In Progress', 3, 1),
(2, 'Login Komponente bauen', 'Authentifizierungsmaske mit JWT Integration.', 'Done', 3, 1),
(2, 'Responsive Design', 'Optimierung der Views für mobile Endgeräte.', 'To Do', 2, 1);
