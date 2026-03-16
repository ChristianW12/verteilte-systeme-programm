'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db'); 

// TODO: create route for creating a new task
router.post('/create', async (req, res) => {});

// IMPORTANT: userId des Frontend mitübergeben, damit backend überprüfen kann ob user diese Task löschen darf 
router.post('/delete', async (req, res) => {});

// TODO: edit route for editing a task
// IMPORTANT: userId des Frontend mitübergeben, damit backend überprüfen kann ob user diese Task bearbeiten darf
router.post('/edit', async (req, res) => {});

router.post('/get', async (req, res) => {});
module.exports = router;
