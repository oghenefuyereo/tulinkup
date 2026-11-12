
// Import Express to create routes for retrieving tags.
const express = require("express");

// Import the functions that handle tag requests.
const {
  getTags,
  getTagById,
} = require("../controllers/tagController");

// Create a router to handle tag requests.
const router = express.Router();

// Public route to get all available tags.
router.get("/", getTags);

// Public route to get a specific tag using its ID.
router.get("/:id", getTagById);

// Export the router so it can be used in the main server.
module.exports = router;
