'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');

const allowedStatus = ['To Do', 'In Progress', 'Done'];
const allowedPriority = ['Low', 'Medium', 'High'];

router.post('/create', async (req, res) => {
  const { project_id, title, description, status, priority, deadline, created_by } = req.body;

  if (!project_id || !title || !created_by) {
    return res.status(400).json({
      message: 'project_id, title und created_by sind erforderlich',
    });
  }

  const projectId = Number(project_id);
  const createdBy = Number(created_by);
  const cleanTitle = String(title).trim();
  const cleanDescription = description ? String(description).trim() : null;
  const taskStatus = status || 'To Do';
  const taskPriority = priority || 'Medium';
  const taskDeadline = deadline || null;

  if (!Number.isInteger(projectId) || projectId <= 0 || !Number.isInteger(createdBy) || createdBy <= 0) {
    return res.status(400).json({
      message: 'project_id und created_by muessen gueltige Zahlen sein',
    });
  }

  if (!cleanTitle) {
    return res.status(400).json({
      message: 'Titel darf nicht leer sein',
    });
  }

  if (!allowedStatus.includes(taskStatus)) {
    return res.status(400).json({
      message: 'Ungueltiger Status',
    });
  }

  if (!allowedPriority.includes(taskPriority)) {
    return res.status(400).json({
      message: 'Ungueltige Prioritaet',
    });
  }

  try {
    const [projectRows] = await db.execute(
      'SELECT project_id FROM projects WHERE project_id = ?',
      [projectId],
    );

    if (projectRows.length === 0) {
      return res.status(404).json({ message: 'Projekt nicht gefunden' });
    }

    const [userRows] = await db.execute(
      'SELECT user_id FROM users WHERE user_id = ?',
      [createdBy],
    );

    if (userRows.length === 0) {
      return res.status(404).json({ message: 'Benutzer nicht gefunden' });
    }

    await db.execute(
      `INSERT INTO tasks (
        project_id,
        title,
        description,
        status,
        priority,
        deadline,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [projectId, cleanTitle, cleanDescription, taskStatus, taskPriority, taskDeadline, createdBy],
    );

    return res.status(201).json({ message: 'Task erfolgreich erstellt' });
  } catch (error) {
    console.error('Fehler beim Erstellen der Task:', error);
    return res.status(500).json({ message: 'Interner Serverfehler' });
  }
});

// IMPORTANT: userId des Frontend mitübergeben, damit backend überprüfen kann ob user diese Task löschen darf
router.post('/delete', async (_req, _res) => {});

// TODO: edit route for editing a task
// IMPORTANT: userId des Frontend mitübergeben, damit backend überprüfen kann ob user diese Task bearbeiten darf
router.post('/edit', async (_req, _res) => {});

router.get('/project/:projectId', async (req, res) => {
  const projectId = Number(req.params.projectId);

  if (!Number.isInteger(projectId) || projectId <= 0) {
    return res.status(400).json({ message: 'Ungueltige projectId' });
  }

  try {
    const [tasks] = await db.execute(
      `SELECT t.task_id,
              t.project_id,
              t.title,
              t.status,
              t.deadline,
              assignee.email AS assigned_to
       FROM tasks t
       LEFT JOIN users assignee ON assignee.user_id = t.assigned_to
       WHERE t.project_id = ?
       ORDER BY t.created_at DESC`,
      [projectId],
    );

    return res.status(200).json({ tasks });
  } catch (error) {
    console.error('Fehler beim Laden der Tasks:', error);
    return res.status(500).json({ message: 'Interner Serverfehler' });
  }
});

router.post('/get', async (_req, res) => {
  try {
    const [projects] = await db.execute(
      'SELECT project_id, name FROM projects ORDER BY name ASC',
    );

    return res.json({ projects });
  } catch (error) {
    console.error('Fehler beim Laden der Projekte:', error);
    return res.status(500).json({ message: 'Interner Serverfehler' });
  }
});

module.exports = router;