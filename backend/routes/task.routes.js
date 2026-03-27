"use strict";

const express = require("express");
const router = express.Router();
const db = require("../db");
const { getClient, publishEvent } = require("../realtime.publisher");

const allowedStatus = ["To Do", "In Progress", "Done", "Blocked"];
const allowedPriority = ["Low", "Medium", "High"];

const LOCK_TTL = 120;

// --- Lock Endpoints ---

router.post("/lock/acquire", async (req, res) => {
  const { task_id, user_id, user_email } = req.body;
  const taskId = Number(task_id);
  const userId = Number(user_id);

  if (!taskId || !userId || !user_email) {
    return res.status(400).json({ message: "Fehlende Parameter für Lock" });
  }

  try {
    const redis = await getClient();
    const lockKey = `lock:task:${taskId}`;
    const lockData = JSON.stringify({ userId, userEmail: user_email, at: Date.now() });
    const success = await redis.set(lockKey, lockData, { NX: true, EX: LOCK_TTL });

    if (success) {
      await publishEvent("task.locked", { taskId, userEmail: user_email, userId });
      return res.status(200).json({ message: "Lock erfolgreich erworben" });
    } else {
      const currentLockRaw = await redis.get(lockKey);
      const currentLock = currentLockRaw ? JSON.parse(currentLockRaw) : null;
      
      // Falls der gleiche User den Lock bereits hat, als Erfolg werten (Renew)
      if (currentLock && Number(currentLock.userId) === userId) {
        await redis.expire(lockKey, LOCK_TTL);
        return res.status(200).json({ message: "Lock erneuert" });
      }

      return res.status(423).json({ 
        message: "Task wird bereits bearbeitet", 
        lockedByEmail: currentLock?.userEmail || "Unbekannt"
      });
    }
  } catch (error) {
    console.error("Lock Acquire Fehler:", error);
    res.status(500).json({ message: "Interner Serverfehler beim Locking" });
  }
});

router.post("/lock/heartbeat", async (req, res) => {
  const { task_id, user_id } = req.body;
  const taskId = Number(task_id);
  const userId = Number(user_id);

  try {
    const redis = await getClient();
    const lockKey = `lock:task:${taskId}`;
    const currentLockRaw = await redis.get(lockKey);

    if (!currentLockRaw) return res.status(404).json({ message: "Kein aktiver Lock" });

    const currentLock = JSON.parse(currentLockRaw);
    if (Number(currentLock.userId) !== userId) return res.status(403).json({ message: "Nicht Besitzer" });

    await redis.expire(lockKey, LOCK_TTL);
    res.status(200).json({ message: "OK" });
  } catch (error) {
    res.status(500).json({ message: "Fehler" });
  }
});

router.post("/lock/release", async (req, res) => {
  const { task_id, user_id } = req.body;
  const taskId = Number(task_id);
  const userId = Number(user_id);

  try {
    const redis = await getClient();
    const lockKey = `lock:task:${taskId}`;
    const currentLockRaw = await redis.get(lockKey);

    if (currentLockRaw) {
      const currentLock = JSON.parse(currentLockRaw);
      if (Number(currentLock.userId) === userId) {
        await redis.del(lockKey);
        await publishEvent("task.unlocked", { taskId });
      }
    }
    res.status(200).json({ message: "Freigegeben" });
  } catch (error) {
    res.status(500).json({ message: "Fehler" });
  }
});

async function getTaskPermissionContext(taskId, userId) {
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

  const rawRole = memberRows.length > 0 ? String(memberRows[0].role) : "";
  const role = rawRole.toLowerCase();
  const isAdmin = role === "admin";
  const isAssignedDeveloper =
    role === "developer" && Number(task.assigned_to) === userId;

  return {
    task,
    role: rawRole || null,
    canEdit: isAdmin || isAssignedDeveloper,
    canDelete: isAdmin || isAssignedDeveloper,
    canEditAssignee: isAdmin,
  };
}

router.post("/create", async (req, res) => {
  const {
    project_id,
    title,
    description,
    status,
    priority,
    deadline,
    created_by,
    assigned_to,
  } = req.body;

  if (!project_id || !title || !created_by) {
    return res.status(400).json({
      message: "project_id, title und created_by sind erforderlich",
    });
  }

  const projectId = Number(project_id);
  const createdBy = Number(created_by);
  const cleanTitle = String(title).trim();
  const cleanDescription = description ? String(description).trim() : null;
  const taskStatus = status || "To Do";
  const taskPriority = priority || "Medium";
  const taskDeadline = deadline || null;
  const assignedToId = assigned_to ? Number(assigned_to) : null;

  if (
    !Number.isInteger(projectId) ||
    projectId <= 0 ||
    !Number.isInteger(createdBy) ||
    createdBy <= 0
  ) {
    return res.status(400).json({
      message: "project_id und created_by muessen gueltige Zahlen sein",
    });
  }

  if (!cleanTitle) {
    return res.status(400).json({
      message: "Titel darf nicht leer sein",
    });
  }

  if (cleanTitle.length > 50) {
    return res.status(400).json({
      message: "Titel darf maximal 50 Zeichen lang sein",
    });
  }

  if (cleanDescription && cleanDescription.length > 1000) {
    return res.status(400).json({
      message: "Beschreibung darf maximal 1000 Zeichen lang sein",
    });
  }

  if (!allowedStatus.includes(taskStatus)) {
    return res.status(400).json({
      message: "Ungueltiger Status",
    });
  }

  if (!allowedPriority.includes(taskPriority)) {
    return res.status(400).json({
      message: "Ungueltige Prioritaet",
    });
  }

  try {
    const [projectRows] = await db.execute(
      "SELECT project_id FROM projects WHERE project_id = ?",
      [projectId],
    );

    if (projectRows.length === 0) {
      return res.status(404).json({ message: "Projekt nicht gefunden" });
    }

    const [userRows] = await db.execute(
      "SELECT user_id FROM users WHERE user_id = ?",
      [createdBy],
    );

    if (userRows.length === 0) {
      return res.status(404).json({ message: "Benutzer nicht gefunden" });
    }

    if (assignedToId) {
      const [assigneeRows] = await db.execute(
        `SELECT pm.user_id
         FROM project_members pm
         WHERE pm.project_id = ?
           AND pm.user_id = ?
           AND LOWER(pm.role) IN ('admin', 'developer')`,
        [projectId, assignedToId],
      );

      if (assigneeRows.length === 0) {
        return res.status(400).json({
          message: "Der Bearbeiter ist kein gueltiges Projektmitglied",
        });
      }
    }

    const [insertResult] = await db.execute(
      `INSERT INTO tasks (
        project_id,
        title,
        description,
        status,
        priority,
        deadline,
        created_by,
        assigned_to
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        cleanTitle,
        cleanDescription,
        taskStatus,
        taskPriority,
        taskDeadline,
        createdBy,
        assignedToId,
      ],
    );

    const newTaskId = insertResult.insertId;
    await publishEvent("task.created", {
      taskId: newTaskId,
      projectId,
      title: cleanTitle,
      createdBy,
    });

    return res.status(201).json({ message: "Task erfolgreich erstellt" });
  } catch (error) {
    console.error("Fehler beim Erstellen der Task:", error);
    return res.status(500).json({ message: "Interner Serverfehler" });
  }
});

router.post("/delete", async (req, res) => {
  const { task_id, user_id } = req.body;
  const taskId = Number(task_id);
  const userId = Number(user_id);

  if (!Number.isInteger(taskId) || taskId <= 0 || !Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Ungueltige Parameter" });
  }

  try {
    const permissions = await getTaskPermissionContext(taskId, userId);
    if (!permissions.task) return res.status(404).json({ message: "Nicht gefunden" });
    if (!permissions.canDelete) return res.status(403).json({ message: "Keine Berechtigung" });

    await db.execute("DELETE FROM tasks WHERE task_id = ?", [taskId]);
    await publishEvent("task.deleted", { taskId, projectId: permissions.task.project_id });
    return res.status(200).json({ message: "Task erfolgreich geloescht" });
  } catch (error) {
    console.error("Fehler beim Loeschen:", error);
    return res.status(500).json({ message: "Interner Serverfehler" });
  }
});

router.post("/edit", async (req, res) => {
  const {
    task_id,
    user_id,
    title,
    description,
    status,
    priority,
    deadline,
    assigned_to,
  } = req.body;

  const taskId = Number(task_id);
  const userId = Number(user_id);

  if (!Number.isInteger(taskId) || taskId <= 0 || !Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Ungueltige Parameter" });
  }

  try {
    const permissions = await getTaskPermissionContext(taskId, userId);
    if (!permissions.task) return res.status(404).json({ message: "Task nicht gefunden" });

    // Lock Check
    const redis = await getClient();
    const lockKey = `lock:task:${taskId}`;
    const currentLockRaw = await redis.get(lockKey);
    if (currentLockRaw) {
      const currentLock = JSON.parse(currentLockRaw);
      if (Number(currentLock.userId) !== userId) {
        return res.status(423).json({ message: "Task ist gesperrt durch " + currentLock.userEmail });
      }
    }

    if (!permissions.canEdit) return res.status(403).json({ message: "Keine Berechtigung" });

    const cleanTitle = String(title || "").trim();
    if (!cleanTitle) return res.status(400).json({ message: "Titel erforderlich" });

    let nextAssignedTo = permissions.task.assigned_to;
    if (assigned_to !== undefined) {
      if (!permissions.canEditAssignee) return res.status(403).json({ message: "Nur Admin darf Bearbeiter aendern" });
      nextAssignedTo = assigned_to === null || assigned_to === "" ? null : Number(assigned_to);
    }

    await db.execute(
      `UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?, deadline = ?, assigned_to = ? WHERE task_id = ?`,
      [cleanTitle, description || null, status || "To Do", priority || "Medium", deadline || null, nextAssignedTo, taskId]
    );

    await publishEvent("task.updated", { taskId, projectId: permissions.task.project_id, title: cleanTitle });
    return res.status(200).json({ message: "Task erfolgreich bearbeitet" });
  } catch (error) {
    console.error("Fehler beim Bearbeiten:", error);
    return res.status(500).json({ message: "Interner Serverfehler" });
  }
});

router.post("/edit/updateStatus", async (req, res) => {
  const { task_id, user_id, status } = req.body;
  const taskId = Number(task_id);
  const userId = Number(user_id);

  try {
    const permissions = await getTaskPermissionContext(taskId, userId);
    if (!permissions.task) return res.status(404).json({ message: "Nicht gefunden" });
    
    // Lock Check
    const redis = await getClient();
    const lockKey = `lock:task:${taskId}`;
    const currentLockRaw = await redis.get(lockKey);
    if (currentLockRaw) {
      const currentLock = JSON.parse(currentLockRaw);
      if (Number(currentLock.userId) !== userId) {
        return res.status(423).json({ message: "Task ist gesperrt durch " + currentLock.userEmail });
      }
    }

    if (!permissions.canEdit) return res.status(403).json({ message: "Keine Berechtigung" });
    if (!allowedStatus.includes(status)) return res.status(400).json({ message: "Ungueltiger Status" });

    await db.execute(`UPDATE tasks SET status = ? WHERE task_id = ?`, [status, taskId]);
    
    // Lock freigeben
    await redis.del(lockKey);
    await publishEvent("task.unlocked", { taskId });

    await publishEvent("task.statusUpdated", { taskId, projectId: permissions.task.project_id, status });
    return res.status(200).json({ message: "Status aktualisiert" });
  } catch (error) {
    return res.status(500).json({ message: "Serverfehler" });
  }
});

router.get("/:id", async (req, res) => {
  const taskId = Number(req.params.id);
  const userId = Number(req.query.user_id);

  if (!Number.isInteger(taskId) || taskId <= 0) {
    return res.status(400).json({ message: "Ungueltige Task-ID" });
  }

  try {
    const [rows] = await db.execute(
      `SELECT t.*, assignee.email AS assigned_to_email FROM tasks t LEFT JOIN users assignee ON assignee.user_id = t.assigned_to WHERE t.task_id = ?`,
      [taskId],
    );

    if (rows.length === 0) return res.status(404).json({ message: "Nicht gefunden" });

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
    if (userId > 0) {
      const pCtx = await getTaskPermissionContext(taskId, userId);
      permissions = { canEdit: pCtx.canEdit, canDelete: pCtx.canDelete, canEditAssignee: pCtx.canEditAssignee };
    }

    return res.status(200).json({ task: normalized, permissions });
  } catch (error) {
    return res.status(500).json({ message: "Serverfehler" });
  }
});

router.get("/project/:projectId", async (req, res) => {
  const projectId = Number(req.params.projectId);
  try {
    const [tasks] = await db.execute(
      `SELECT t.*, assignee.email AS assigned_to FROM tasks t LEFT JOIN users assignee ON assignee.user_id = t.assigned_to WHERE t.project_id = ? ORDER BY t.created_at DESC`,
      [projectId],
    );
    return res.status(200).json({ tasks });
  } catch (error) {
    return res.status(500).json({ message: "Serverfehler" });
  }
});

router.post("/get", async (req, res) => {
  const { user_id } = req.body;
  try {
    const [projects] = await db.execute(
      `SELECT p.* FROM projects p JOIN project_members pm ON p.project_id = pm.project_id WHERE pm.user_id = ? AND pm.role IN ('Admin', 'Developer') ORDER BY p.name ASC`,
      [Number(user_id)],
    );
    return res.json({ projects });
  } catch (error) {
    return res.status(500).json({ message: "Serverfehler" });
  }
});

router.get("/:id/assignees", async (req, res) => {
  const taskId = Number(req.params.id);
  const userId = Number(req.query.user_id);
  try {
    const pCtx = await getTaskPermissionContext(taskId, userId);
    if (!pCtx.task || !pCtx.canEditAssignee) return res.status(403).json({ message: "Keine Berechtigung" });

    const [assignees] = await db.execute(
      `SELECT u.user_id, u.email FROM project_members pm JOIN users u ON u.user_id = pm.user_id WHERE pm.project_id = ? AND pm.role IN ('Admin', 'Developer') ORDER BY u.email ASC`,
      [pCtx.task.project_id],
    );
    return res.status(200).json({ assignees });
  } catch (error) {
    return res.status(500).json({ message: "Serverfehler" });
  }
});

module.exports = router;
