'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');

const allowedStatus = ['To Do', 'In Progress', 'Done', 'Blocked'];
const allowedPriority = ['Low', 'Medium', 'High'];

export async function getTaskPermissionContext(taskId, userId) {
  const [taskRows] = await db.execute(
    `SELECT task_id, project_id, assigned_to
     FROM tasks
     WHERE task_id = ?`,
    [taskId],
  );

  if (taskRows.length === 0) {
    return { task: null, role: null, canEdit: false, canDelete: false };
  }

  const task = taskRows[0];

  const [memberRows] = await db.execute(
    `SELECT role
     FROM project_members
     WHERE project_id = ? AND user_id = ?`,
    [task.project_id, userId],
  );

  const rawRole = memberRows.length > 0 ? String(memberRows[0].role) : '';
  const role = rawRole.toLowerCase();
  const isAdmin = role === 'admin';
  const isAssignedDeveloper = role === 'developer' && Number(task.assigned_to) === userId;

  return {
    task,
    role: rawRole || null,
    canEdit: isAdmin || isAssignedDeveloper,
    canDelete: isAdmin || isAssignedDeveloper,
    canEditAssignee: isAdmin,
  };
}

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
router.post('/delete', async (req, res) => {
  const { task_id, user_id } = req.body;

  const taskId = Number(task_id);
  const userId = Number(user_id);

  if (!Number.isInteger(taskId) || taskId <= 0 || !Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: 'task_id und user_id muessen gueltige Zahlen sein' });
  }

  try {
    const permissions = await getTaskPermissionContext(taskId, userId);

    if (!permissions.task) {
      return res.status(404).json({ message: 'Task nicht gefunden' });
    }

    if (!permissions.canDelete) {
      return res.status(403).json({ message: 'Keine Berechtigung zum Loeschen dieser Task' });
    }

    await db.execute('DELETE FROM tasks WHERE task_id = ?', [taskId]);

    return res.status(200).json({ message: 'Task erfolgreich geloescht' });
  } catch (error) {
    console.error('Fehler beim Loeschen der Task:', error);
    return res.status(500).json({ message: 'Interner Serverfehler' });
  }
});

// TODO: edit route for editing a task
// IMPORTANT: userId des Frontend mitübergeben, damit backend überprüfen kann ob user diese Task bearbeiten darf
router.post('/edit', async (req, res) => {
  const { task_id, user_id, title, description, status, priority, deadline, assigned_to } = req.body;

  const taskId = Number(task_id);
  const userId = Number(user_id);

  if (!Number.isInteger(taskId) || taskId <= 0 || !Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: 'task_id und user_id muessen gueltige Zahlen sein' });
  }

  const cleanTitle = String(title || '').trim();
  const cleanDescription = description !== undefined ? String(description || '').trim() : null;
  const nextStatus = status || 'To Do';
  const nextPriority = priority || 'Medium';
  const nextDeadline = deadline || null;

  if (!cleanTitle) {
    return res.status(400).json({ message: 'Titel darf nicht leer sein' });
  }

  if (!allowedStatus.includes(nextStatus)) {
    return res.status(400).json({ message: 'Ungueltiger Status' });
  }

  if (!allowedPriority.includes(nextPriority)) {
    return res.status(400).json({ message: 'Ungueltige Prioritaet' });
  }

  try {
    const permissions = await getTaskPermissionContext(taskId, userId);

    if (!permissions.task) {
      return res.status(404).json({ message: 'Task nicht gefunden' });
    }

    if (!permissions.canEdit) {
      return res.status(403).json({ message: 'Keine Berechtigung zum Bearbeiten dieser Task' });
    }

    let nextAssignedTo = permissions.task.assigned_to;

    if (assigned_to !== undefined) {
      if (!permissions.canEditAssignee) {
        return res.status(403).json({ message: 'Nur Admin darf den Bearbeiter aendern' });
      }

      if (assigned_to === null || assigned_to === '') {
        nextAssignedTo = null;
      } else {
        const parsedAssignedTo = Number(assigned_to);
        if (!Number.isInteger(parsedAssignedTo) || parsedAssignedTo <= 0) {
          return res.status(400).json({ message: 'assigned_to muss eine gueltige Zahl oder leer sein' });
        }

        const [assigneeRows] = await db.execute(
          `SELECT pm.user_id
           FROM project_members pm
           WHERE pm.project_id = ?
             AND pm.user_id = ?
             AND pm.role IN ('Admin', 'Developer')`,
          [permissions.task.project_id, parsedAssignedTo],
        );

        if (assigneeRows.length === 0) {
          return res.status(400).json({ message: 'Der Bearbeiter ist kein gueltiges Projektmitglied' });
        }

        nextAssignedTo = parsedAssignedTo;
      }
    }

    await db.execute(
      `UPDATE tasks
       SET title = ?,
           description = ?,
           status = ?,
           priority = ?,
           deadline = ?,
           assigned_to = ?
       WHERE task_id = ?`,
      [cleanTitle, cleanDescription, nextStatus, nextPriority, nextDeadline, nextAssignedTo, taskId],
    );

    return res.status(200).json({ message: 'Task erfolgreich bearbeitet' });
  } catch (error) {
    console.error('Fehler beim Bearbeiten der Task:', error);
    return res.status(500).json({ message: 'Interner Serverfehler' });
  }
});

router.get('/:id/assignees', async (req, res) => {
  const taskId = Number(req.params.id);
  const userId = Number(req.query.user_id);

  if (!Number.isInteger(taskId) || taskId <= 0 || !Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: 'Ungueltige taskId oder user_id' });
  }

  try {
    const permissions = await getTaskPermissionContext(taskId, userId);

    if (!permissions.task) {
      return res.status(404).json({ message: 'Task nicht gefunden' });
    }

    if (!permissions.canEditAssignee) {
      return res.status(403).json({ message: 'Nur Admin darf Bearbeiter laden' });
    }

    const [assignees] = await db.execute(
      `SELECT u.user_id, u.email
       FROM project_members pm
       JOIN users u ON u.user_id = pm.user_id
       WHERE pm.project_id = ?
         AND pm.role IN ('Admin', 'Developer')
       ORDER BY u.email ASC`,
      [permissions.task.project_id],
    );

    return res.status(200).json({ assignees });
  } catch (error) {
    console.error('Fehler beim Laden der Bearbeiter:', error);
    return res.status(500).json({ message: 'Interner Serverfehler' });
  }
});

router.get('/:id', async (req, res) => {
  const taskId = Number(req.params.id);
  const userId = Number(req.query.user_id);

  if (!Number.isInteger(taskId) || taskId <= 0) {
    return res.status(400).json({ message: 'Ungueltige Task-ID' });
  }

  try {
    const [rows] = await db.execute(
      `SELECT t.task_id, t.project_id, t.title, t.description, t.status, t.priority, t.deadline, t.assigned_to,
              assignee.email AS assigned_to_email
       FROM tasks t
       LEFT JOIN users assignee ON assignee.user_id = t.assigned_to
       WHERE t.task_id = ?`,
      [taskId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Task nicht gefunden' });
    }

    const task = rows[0];
    const normalized = {
      task_id: task.task_id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      deadline: task.deadline,
      assigned_to: task.assigned_to_email || null,
      assigned_to_id: task.assigned_to || null,
    };

    let permissions = { canEdit: false, canDelete: false, canEditAssignee: false };

    if (Number.isInteger(userId) && userId > 0) {
      const permissionContext = await getTaskPermissionContext(taskId, userId);
      permissions = {
        canEdit: permissionContext.canEdit,
        canDelete: permissionContext.canDelete,
        canEditAssignee: permissionContext.canEditAssignee,
      };
    }

    return res.status(200).json({ task: normalized, permissions });
  } catch (error) {
    console.error('Fehler beim Laden der Task:', error);
    return res.status(500).json({ message: 'Interner Serverfehler' });
  }
});

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
              assignee.email AS assigned_to,
              t.created_by
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

