-- Initialschema + Seeddaten
-- Ziel: String-basierte user_id, gehashte Passwoerter, reduzierte Testdaten

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS project_members;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS auth_refresh_tokens;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Benutzer
CREATE TABLE users (
    user_id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Projekte
CREATE TABLE auth_refresh_tokens (
    token_id INT AUTO_INCREMENT PRIMARY KEY,
    jti VARCHAR(128) NOT NULL UNIQUE,
    user_id VARCHAR(64) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME NULL,
    replaced_by_jti VARCHAR(128) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_expires_at (expires_at),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 3. Projekte
CREATE TABLE projects (
    project_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(64) DEFAULT NULL,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 4. Aufgaben
CREATE TABLE tasks (
    task_id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    assigned_to VARCHAR(64),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status ENUM('To Do', 'In Progress', 'Done', 'Blocked') DEFAULT 'To Do',
    priority ENUM('Low', 'Medium', 'High') DEFAULT 'Medium',
    deadline DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by VARCHAR(64),
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- 5. Kommentare
CREATE TABLE comments (
    comment_id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 6. Projektmitglieder
CREATE TABLE project_members (
    member_id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    role ENUM('Developer', 'Admin', 'Viewer') DEFAULT 'Viewer',
    added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_project_user (project_id, user_id),
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Seed-User (4 Benutzer, gehashte Passwoerter)
INSERT INTO users (user_id, username, email, password) VALUES
('usr_3f8a1c2e9b4d7f1a', 'christian', 'christian@example.com', '$2b$10$CGzKA/aFpGkjSbHJXatl0eCkPi2NJhJlDeBkj4SeZFelL06fu.6ba'),
('usr_7d2e5f9a1c3b8e4f', 'alex', 'alex@example.com', '$2b$10$u8gIKn/SSVMwt8j66grlKOr.83yu/OItAzqv9OysG0vncYfUKAa0u'),
('usr_4a9e2b7c5d1f6e3a', 'luca', 'luca@example.com', '$2b$10$Pwz1us2/VXxQY3nJiFUyher/omMemdqNtEyql0AOPImcGI/Y1wLZG'),
('usr_8c1d4e7a2b9f5c6d', 'melina', 'melina@example.com', '$2b$10$Shvv31fVNWZsIvXAQoqqAeCL4Q9nPNfaVd2cFqGybDDLY3BhCS0.W');

-- Seed-Projekte (2 Projekte)
INSERT INTO projects (name, description, created_by) VALUES
('Verteilte Systeme Projekt', 'Entwicklung einer skalierbaren Jira-Alternative mit Docker und Node.js.', 'usr_3f8a1c2e9b4d7f1a'),
('Frontend Redesign', 'Modernisierung der Benutzeroberflaeche auf Basis von Angular 19.', 'usr_3f8a1c2e9b4d7f1a');

-- Projektmitglieder
INSERT INTO project_members (project_id, user_id, role) VALUES
(1, 'usr_3f8a1c2e9b4d7f1a', 'Admin'),
(1, 'usr_7d2e5f9a1c3b8e4f', 'Developer'),
(1, 'usr_8c1d4e7a2b9f5c6d', 'Developer'),
(1, 'usr_4a9e2b7c5d1f6e3a', 'Viewer'),
(2, 'usr_3f8a1c2e9b4d7f1a', 'Admin'),
(2, 'usr_8c1d4e7a2b9f5c6d', 'Developer'),
(2, 'usr_7d2e5f9a1c3b8e4f', 'Viewer'),
(2, 'usr_4a9e2b7c5d1f6e3a', 'Developer');

-- Aufgaben fuer Projekt 1
INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, created_by) VALUES
(1, 'Datenbank aufsetzen', 'Entwurf und Implementierung des relationalen Datenmodells in MySQL.', 'Done', 'High', 'usr_7d2e5f9a1c3b8e4f', 'usr_3f8a1c2e9b4d7f1a'),
(1, 'Backend API implementieren', 'Entwicklung der REST-Endpunkte mit Express.js und Validierung.', 'In Progress', 'High', 'usr_7d2e5f9a1c3b8e4f', 'usr_3f8a1c2e9b4d7f1a'),
(1, 'Dockerisierung', 'Erstellung von Dockerfiles fuer Frontend und Backend.', 'To Do', 'Medium', 'usr_8c1d4e7a2b9f5c6d', 'usr_3f8a1c2e9b4d7f1a'),
(1, 'Load Balancer konfigurieren', 'Einrichtung von Nginx als Reverse Proxy zur Lastverteilung.', 'To Do', 'Medium', 'usr_3f8a1c2e9b4d7f1a', 'usr_3f8a1c2e9b4d7f1a');

-- Aufgaben fuer Projekt 2
INSERT INTO tasks (project_id, title, description, status, priority, assigned_to, created_by) VALUES
(2, 'Landing Page erstellen', 'Entwicklung einer responsiven Startseite mit modernem UI/UX-Design.', 'In Progress', 'Medium', 'usr_8c1d4e7a2b9f5c6d', 'usr_3f8a1c2e9b4d7f1a'),
(2, 'Login Komponente bauen', 'Implementierung eines sicheren Login-Flows.', 'Done', 'High', 'usr_8c1d4e7a2b9f5c6d', 'usr_3f8a1c2e9b4d7f1a'),
(2, 'Responsive Design', 'Anpassung der Layouts fuer mobile Endgeraete und Tablets.', 'To Do', 'Medium', 'usr_4a9e2b7c5d1f6e3a', 'usr_3f8a1c2e9b4d7f1a');
