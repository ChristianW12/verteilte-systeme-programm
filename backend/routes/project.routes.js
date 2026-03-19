"use strict";

const express = require("express");
const router = express.Router();
const db = require("../db");

// TODO: create route for creating a new project
router.post("/create", async (req, res) => {});

// TODO: delete route for deleting a project
// IMPORTANT: userId des Frontend mitübergeben, damit backend überprüfen kann ob user diese Project löschen darf
router.post("/delete", async (req, res) => {});

// TODO: edit route for editing a project
// IMPORTANT: userId des Frontend mitübergeben, damit backend überprüfen kann ob user diese Project bearbeiten darf
router.post("/edit", async (req, res) => {});

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

    const response = {
      userId: userId,
      projects: projects.map((p) => ({
        project_id: p.project_id,
        name: p.name,
        description: p.description,
        created_by: p.email_creator,
        admin_id: p.created_by,
        role: p.role,
      })),
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Fehler beim Laden der Projekte:", error);
    return res.status(500).json({ message: "Interner Serverfehler" });
  }
});

module.exports = router;
