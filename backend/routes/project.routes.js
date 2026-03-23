"use strict";

const express = require("express");
const router = express.Router();
const db = require("../db");

router.post("/create", async (req, res) => {
  const { name, description, createdBy, members } = req.body;

  const createdById = Number(createdBy);
  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: "Projektname ist erforderlich" });
  }

  if (!Number.isInteger(createdById) || createdById <= 0) {
    return res.status(400).json({ message: "Ungueltige createdBy-ID" });
  }

  const allowedRoles = new Set(["Admin", "Developer", "Viewer"]);
  const rawMembers = Array.isArray(members) ? members : [];
  const normalizedMembers = rawMembers
    .map((member) => ({
      email: String(member?.email || "").trim().toLowerCase(),
      role: allowedRoles.has(member?.role) ? member.role : "Viewer",
    }))
    .filter((member) => member.email.length > 0);

  const uniqueMembersMap = new Map();
  for (const member of normalizedMembers) {
    uniqueMembersMap.set(member.email, member);
  }
  const uniqueMembers = Array.from(uniqueMembersMap.values());

  try {
    let usersByEmail = new Map();

    if (uniqueMembers.length > 0) {
      const placeholders = uniqueMembers.map(() => "?").join(", ");
      const [userRows] = await db.query(
        `SELECT user_id, email FROM users WHERE email IN (${placeholders})`,
        uniqueMembers.map((member) => member.email),
      );

      usersByEmail = new Map(
        userRows.map((user) => [String(user.email).toLowerCase(), user]),
      );

      const missingEmails = uniqueMembers
        .filter((member) => !usersByEmail.has(member.email))
        .map((member) => member.email);

      if (missingEmails.length > 0) {
        return res.status(400).json({
          message: "Folgende E-Mails wurden nicht gefunden",
          missingEmails,
        });
      }
    }

    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const [insertProjectResult] = await connection.execute(
        "INSERT INTO projects (name, description, created_by) VALUES (?, ?, ?)",
        [String(name).trim(), String(description || "").trim() || null, createdById],
      );

      const projectId = insertProjectResult.insertId;

      await connection.execute(
        "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'Admin') ON DUPLICATE KEY UPDATE role = 'Admin'",
        [projectId, createdById],
      );

      for (const member of uniqueMembers) {
        const user = usersByEmail.get(member.email);
        if (!user) {
          continue;
        }

        if (Number(user.user_id) === createdById) {
          continue;
        }

        await connection.execute(
          "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role)",
          [projectId, user.user_id, member.role],
        );
      }

      await connection.commit();

      return res.status(201).json({
        message: "Projekt erfolgreich erstellt",
        project_id: projectId,
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Fehler beim Erstellen des Projekts:", error);
    return res.status(500).json({ message: "Interner Serverfehler" });
  }
});

// TODO: delete route for deleting a project
// IMPORTANT: userId des Frontend mitübergeben, damit backend überprüfen kann ob user diese Project löschen darf
router.post("/delete", async (req, res) => {});

// TODO: edit route for editing a project
// IMPORTANT: userId des Frontend mitübergeben, damit backend überprüfen kann ob user diese Project bearbeiten darf
router.post("/edit", async (req, res) => {
  const { project_id, user_id } = req.body;

  const projectId = Number(project_id);
  const userId = Number(user_id);

  if (!Number.isInteger(projectId) || projectId <= 0 || !Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Ungueltige project_id oder user_id" });
  }

  try {
    // Prüfe ob User Admin dieses Projekts ist
    const [adminRows] = await db.execute(
      `SELECT pm.user_id FROM project_members pm
       JOIN projects p ON pm.project_id = p.project_id
       WHERE pm.project_id = ? 
         AND pm.user_id = ?
         AND p.created_by = ?`,
      [projectId, userId, userId],
    );

    if (adminRows.length === 0) {
      return res.status(403).json({ message: "Keine Berechtigung zum Bearbeiten dieses Projekts" });
    }

    // Autorisierung erfolgreich - weitere Update-Logik kommt später
    return res.status(200).json({ message: "Autorisierung erfolgreich" });
  } catch (error) {
    console.error("Fehler bei der Autorisierungsprüfung:", error);
    return res.status(500).json({ message: "Interner Serverfehler" });
  }
});

router.get("/member-search", async (req, res) => {
  const query = String(req.query.query || "").trim();

  if (query.length < 2) {
    return res.status(200).json({ users: [] });
  }

  try {
    const [rows] = await db.execute(
      `SELECT user_id, email
       FROM users
       WHERE email LIKE CONCAT('%', ?, '%')
       ORDER BY email ASC
       LIMIT 8`,
      [query],
    );

    return res.status(200).json({
      users: rows.map((row) => ({
        user_id: row.user_id,
        email: row.email,
      })),
    });
  } catch (error) {
    console.error("Fehler bei der Member-Suche:", error);
    return res.status(500).json({ message: "Interner Serverfehler" });
  }
});

router.get("/get/:userId", async (req, res) => {
  const userId = Number(req.params.userId);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Ungueltige userId" });
  }

  try {
    const [projects] = await db.query(
      `select p.project_id, p.name, p.description, u.email, u.user_id, p.created_by, u_created.email as email_creator, pm.role
      from project_members pm 
      join users u on  pm.user_id = u.user_id
      join projects p on pm.project_id = p.project_id
      join users u_created on p.created_by = u_created.user_id
      where pm.user_id = ?;`,
      [userId],
    );

    const [projectMembers] = await db.query(
      `SELECT u.user_id, u.username, u.email, pm.project_id, pm.role
       FROM project_members pm
       JOIN users u ON u.user_id = pm.user_id
       WHERE pm.project_id IN (
         SELECT pm1.project_id
         FROM project_members pm1
         WHERE pm1.user_id = ?
       )
       ORDER BY pm.project_id ASC, u.email ASC`,
      [userId],
    );

    const membersByProjectId = new Map();
    for (const member of projectMembers) {
      const projectId = Number(member.project_id);

      if (!membersByProjectId.has(projectId)) {
        membersByProjectId.set(projectId, []);
      }

      membersByProjectId.get(projectId).push({
        user_id: member.user_id,
        username: member.username,
        email: member.email,
        role: member.role,
      });
    }

    const response = {
      userId: userId,
      projects: projects.map((p) => ({
        project_id: p.project_id,
        name: p.name,
        description: p.description,
        created_by: p.email_creator,
        admin_id: p.created_by,
        role: p.role,
        members: membersByProjectId.get(Number(p.project_id)) || [],
      })),
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Fehler beim Laden der Projekte:", error);
    return res.status(500).json({ message: "Interner Serverfehler" });
  }
});

router.get("/:projectId/assignees", async (req, res) => {
  const projectId = Number(req.params.projectId);

  if (!Number.isInteger(projectId) || projectId <= 0) {
    return res.status(400).json({ message: "Ungueltige projectId" });
  }

  try {
    const [users] = await db.execute(
      `SELECT u.user_id, u.email
       FROM project_members pm
       JOIN users u ON pm.user_id = u.user_id
       WHERE pm.project_id = ?
         AND LOWER(pm.role) IN ('admin', 'developer')
       ORDER BY u.email ASC`,
      [projectId],
    );

    return res.status(200).json({ users });
  } catch (error) {
    console.error("Fehler beim Laden der Assignees:", error);
    return res.status(500).json({ message: "Interner Serverfehler" });
  }
});

module.exports = router;
