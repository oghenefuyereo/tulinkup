
// Import Express to create routes for managing tutor profiles.
const express = require("express");

// Import the middleware that checks whether a user is logged in.
const { protect } = require("../middleware/authMiddleware");

// Import the functions that handle tutor profile requests.
const {
  getTutorProfiles,
  getTutorProfileBySlug,
  createTutorProfile,
  updateTutorProfile,
  deleteTutorProfile,
} = require("../controllers/tutorProfileController");

// Create a router to handle tutor profile requests.
const router = express.Router();

// Public route to get all available tutor profiles.
router.get("/", getTutorProfiles);

// Public route to get a specific tutor profile using its URL slug.
router.get("/:slug", getTutorProfileBySlug);

// Protected route to allow tutors to create their profiles.
router.post("/", protect, createTutorProfile);

// Protected route to allow tutors to update their own profiles.
router.put("/:id", protect, updateTutorProfile);

// Protected route to allow tutors to delete their own profiles.
router.delete("/:id", protect, deleteTutorProfile);

// Export the router so it can be used in the main server.
module.exports = router;
