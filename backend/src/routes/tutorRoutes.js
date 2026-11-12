
// Import Express to create routes for tutor information.
const express = require("express");

// Import the middleware that checks whether a user is logged in.
const { protect } = require("../middleware/authMiddleware");

// Import the functions that handle tutor profiles and availability details.
const {
  getMyTutorProfile,
  getTutors,
  getTutorBySlug,
  getTutorExtras,
} = require("../controllers/tutorController");

// Create a router to handle tutor requests.
const router = express.Router();

// Private tutor dashboard profile
// Allow logged-in tutors to view their own profile information.
router.get("/me/profile", protect, getMyTutorProfile);

// Public tutor discovery
// Allow visitors to view the list of available tutor profiles.
router.get("/", getTutors);

// Public tutor profile and additional details
// Get additional tutor information, including upcoming availability.
router.get("/:slug/extras", getTutorExtras);

// Get a specific tutor's public profile using their URL slug.
router.get("/:slug", getTutorBySlug);

// Export the router so it can be used in the main server.
module.exports = router;
