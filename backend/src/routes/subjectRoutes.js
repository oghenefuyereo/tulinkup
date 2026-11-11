
const express = require("express");

const {
  getSubjects,
  getSubjectBySlug,
} = require("../controllers/subjectController");

const router = express.Router();

router.get("/", getSubjects);

router.get("/:slug", getSubjectBySlug);

module.exports = router;
