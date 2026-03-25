"use strict";

const express = require("express");
const router = express.Router();
const db = require("../db");
const { publishEvent } = require("../realtime.publisher");

router.post("/create", async (req, res) => {
  const { name, description, createdBy, members } = req.body;

  const createdById = Number(createdBy);
  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: "Projektname ist erforderlich" });
  }

  // Längenvaldierung für Titel und Beschreibung
  if (String(name).trim().length > 80) {
    return res
      .status(400)
      .json({ message: "Projekttitel darf maximal 80 Zeichen lang sein" });
  }

  if (description && String(description).trim().length > 500) {
    return res
      .status(400)
      .json({ message: "Beschreibung darf maximal 500 Zeichen lang sein" });
  }

  if (!Number.isInteger(createdById) || createdById <= 0) {
    return res.status(400).json({ message: "Ungueltige createdBy-ID" });
  }

  const allowedRoles = new Set(["Admin", "Developer", "Viewer"]);
  const rawMembers = Array.isArray(members) ? members : [];
  const normalizedMembers = rawMembers
    .map((member) => ({
      email: String(member?.email || "")
        .trim()
        .toLowerCase(),
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
        [
          String(name).trim(),
          String(description || "").trim() || null,
          createdById,
        ],
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

      await publishEvent("project.created", {
        projectId,
        name,
        createdBy: createdById,
      });

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

// IMPORTANT: userId des Frontend mitübergeben, damit backend überprüfen kann ob user diese Project löschen darf
router.post("/delete", async (req, res) => {
  const { project_id, user_id } = req.body;

  const projectId = Number(project_id);
  const userId = Number(user_id);

  // Input-Validierung
  if (
    !Number.isInteger(projectId) ||
    projectId <= 0 ||
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    return res
      .status(400)
      .json({ message: "Ungültige project_id oder user_id" });
  }

  try {
    // 1. Prüfe ob User der Ersteller (Owner) dieses Projekts ist
    const [projectRows] = await db.execute(
      "SELECT created_by FROM projects WHERE project_id = ?",
      [projectId],
    );

    if (projectRows.length === 0) {
      return res.status(404).json({ message: "Projekt nicht gefunden" });
    }

    const project = projectRows[0];
    if (Number(project.created_by) !== userId) {
      return res
        .status(403)
        .json({ message: "Keine Berechtigung zum Löschen dieses Projekts" });
    }

    // 2. Lösche das Projekt (Tasks werden durch ON DELETE CASCADE automatisch gelöscht)
    await db.execute("DELETE FROM projects WHERE project_id = ?", [projectId]);

    return res.status(200).json({
      message: "Projekt erfolgreich gelöscht",
    });
  } catch (error) {
    console.error("Fehler beim Löschen des Projekts:", error);
    return res.status(500).json({ message: "Interner Serverfehler" });
  }
});

router.post("/edit", async (req, res) => {
  const { project_id, user_id, name, description, members } = req.body;

  const projectId = Number(project_id);
  const userId = Number(user_id);

  // Input-Validierung
  if (
    !Number.isInteger(projectId) ||
    projectId <= 0 ||
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    return res
      .status(400)
      .json({ message: "Ungueltige project_id oder user_id" });
  }

  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: "Projektname ist erforderlich" });
  }

  // Längenvaldierung für Titel und Beschreibung
  if (String(name).trim().length > 80) {
    return res
      .status(400)
      .json({ message: "Projekttitel darf maximal 80 Zeichen lang sein" });
  }

  if (description && String(description).trim().length > 500) {
    return res
      .status(400)
      .json({ message: "Beschreibung darf maximal 500 Zeichen lang sein" });
  }

  const allowedRoles = new Set(["Admin", "Developer", "Viewer"]);
  const rawMembers = Array.isArray(members) ? members : [];
  const normalizedMembers = rawMembers
    .map((member) => ({
      email: String(member?.email || "")
        .trim()
        .toLowerCase(),
      role: allowedRoles.has(member?.role) ? member.role : "Viewer",
    }))
    .filter((member) => member.email.length > 0);

  const uniqueMembersMap = new Map();
  for (const member of normalizedMembers) {
    uniqueMembersMap.set(member.email, member);
  }
  const uniqueMembers = Array.from(uniqueMembersMap.values());

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Prüfe ob User Admin/Owner dieses Projekts ist
    const [adminRows] = await connection.execute(
      `SELECT pm.user_id, p.created_by FROM project_members pm
       JOIN projects p ON pm.project_id = p.project_id
       WHERE pm.project_id = ? 
         AND pm.user_id = ?
         AND p.created_by = ?`,
      [projectId, userId, userId],
    );

    if (adminRows.length === 0) {
      await connection.rollback();
      return res
        .status(403)
        .json({ message: "Keine Berechtigung zum Bearbeiten dieses Projekts" });
    }

    const createdBy = adminRows[0].created_by;

    // 2. Update Projektdaten (Name, Beschreibung)
    await connection.execute(
      "UPDATE projects SET name = ?, description = ? WHERE project_id = ?",
      [
        String(name).trim(),
        String(description || "").trim() || null,
        projectId,
      ],
    );

    // 3. Lade bestehende Member
    const [existingMembers] = await connection.execute(
      `SELECT pm.user_id, u.email, pm.role FROM project_members pm
       JOIN users u ON pm.user_id = u.user_id
       WHERE pm.project_id = ?`,
      [projectId],
    );

    const existingMemberMap = new Map(
      existingMembers.map((member) => [
        String(member.email).toLowerCase(),
        member,
      ]),
    );

    // 4. Lade User-IDs fuer neue/geaenderte Member
    let usersByEmail = new Map();
    if (uniqueMembers.length > 0) {
      const placeholders = uniqueMembers.map(() => "?").join(", ");
      const [userRows] = await connection.execute(
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
        await connection.rollback();
        return res.status(400).json({
          message: "Folgende E-Mails wurden nicht gefunden",
          missingEmails,
        });
      }
    }

    // 5. Berechne Diff: toAdd, toDelete, toRoleUpdate
    const toDelete = [];
    const toRoleUpdate = [];
    const incomingEmails = new Set(uniqueMembers.map((m) => m.email));

    for (const [email, existingMember] of existingMemberMap.entries()) {
      if (!incomingEmails.has(email)) {
        // User ist nicht mehr in der Liste - ABER Owner darf nicht geloescht werden
        if (existingMember.user_id !== createdBy) {
          toDelete.push(existingMember.user_id);
        }
      } else {
        // User ist noch da - Rolle aendern?
        const incomingMember = uniqueMembers.find((m) => m.email === email);
        if (incomingMember && incomingMember.role !== existingMember.role) {
          toRoleUpdate.push({
            user_id: existingMember.user_id,
            new_role: incomingMember.role,
          });
        }
      }
    }

    const toAdd = [];
    for (const member of uniqueMembers) {
      if (!existingMemberMap.has(member.email)) {
        const user = usersByEmail.get(member.email);
        if (user && user.user_id !== userId) {
          toAdd.push({
            user_id: user.user_id,
            role: member.role,
          });
        }
      }
    }

    // 6. Pruefe Regeln: mindestens 1 Admin muss bleiben
    const adminCountAfterChanges =
      existingMembers
        .filter(
          (member) =>
            member.user_id !== createdBy || !toDelete.includes(member.user_id),
        )
        .filter(
          (member) =>
            member.role === "Admin" ||
            toRoleUpdate.find(
              (u) => u.user_id === member.user_id && u.new_role === "Admin",
            ),
        ).length + toAdd.filter((member) => member.role === "Admin").length;

    if (adminCountAfterChanges < 1) {
      await connection.rollback();
      return res
        .status(400)
        .json({ message: "Es muss mindestens ein Admin im Projekt bleiben" });
    }

    // 7. Fuehre Aenderungen aus
    for (const userId of toDelete) {
      await connection.execute(
        "DELETE FROM project_members WHERE project_id = ? AND user_id = ?",
        [projectId, userId],
      );
    }

    for (const update of toRoleUpdate) {
      await connection.execute(
        "UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?",
        [update.new_role, projectId, update.user_id],
      );
    }

    for (const member of toAdd) {
      await connection.execute(
        "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)",
        [projectId, member.user_id, member.role],
      );
    }

    // 8. Commit
    await connection.commit();

    await publishEvent("project.updated", {
      projectId,
      name,
      createdBy: userId,
    });

    return res.status(200).json({
      message: "Projekt erfolgreich aktualisiert",
    });
  } catch (error) {
    await connection.rollback();
    console.error("Fehler beim Bearbeiten des Projekts:", error);
    return res.status(500).json({ message: "Interner Serverfehler" });
  } finally {
    connection.release();
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
