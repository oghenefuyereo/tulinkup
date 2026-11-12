
// Import Express to create routes for retrieving subjects.
const express = require("express");

// Import the functions that handle subject requests.
const {
  getSubjects,
  getSubjectBySlug,
} = require("../controllers/subjectController");

// Create a router to handle subject requests.
const router = express.Router();

// Public route to get all subjects, with optional search and category filters.
router.get("/", getSubjects);

// Public route to get a specific subject using its URL slug.
router.get("/:slug", getSubjectBySlug);

// Export the router so it can be used in the main server.
module.exports = router;
