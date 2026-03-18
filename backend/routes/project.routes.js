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

router.get("/get/:userId", async (req, res) => {
  const userId = Number(req.params.userId);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: "Ungueltige userId" });
  }

  try {
    const [projects] = await db.query(
      "select p.project_id, p.name, p.description, u.email, u.user_id from projects p join users u on u.user_id = p.created_by where p.created_by = ?;",
      [userId],
    );

    const response = {
      userId: userId,
      projects: projects.map((p) => ({
        project_id: p.project_id,
        name: p.name,
        description: p.description,
        created_by: p.email,
        admin_id: p.user_id,
      })),
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Fehler beim Laden der Projekte:", error);
    return res.status(500).json({ message: "Interner Serverfehler" });
  }
});

module.exports = router;
