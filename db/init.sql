-- Wird beim ersten Start automatisch ausgeführt.
-- Tabellen hier anlegen und bei Bedarf mit Beispieldaten füllen.

CREATE TABLE IF NOT EXISTS items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Beispieldaten
INSERT INTO items (name) VALUES ('Erster Eintrag'), ('Zweiter Eintrag');
