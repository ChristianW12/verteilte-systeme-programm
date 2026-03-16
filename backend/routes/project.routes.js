'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db'); 

// TODO: create route for creating a new project
router.post('/create', async (req, res) => {});

// TODO: delete route for deleting a project
// IMPORTANT: userId des Frontend mitübergeben, damit backend überprüfen kann ob user diese Project löschen darf 
router.post('/delete', async (req, res) => {});

// TODO: edit route for editing a project
// IMPORTANT: userId des Frontend mitübergeben, damit backend überprüfen kann ob user diese Project bearbeiten darf
router.post('/edit', async (req, res) => {});

router.post('/get', async (req, res) => {});

module.exports = router;