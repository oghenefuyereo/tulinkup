
// Import Express to create tutor routes.
const express = require("express");

// Import authentication middleware.
const { protect } = require("../middleware/authMiddleware");

// Import tutor controller functions.
const {
  getMyTutorProfile,
  getTutors,
  getTutorBySlug,
  getTutorExtras,
} = require("../controllers/tutorController");

// Create the Express router.
const router = express.Router();

// Private tutor dashboard profile.
router.get("/me/profile", protect, getMyTutorProfile);

// Public tutor marketplace.
router.get("/", getTutors);

// Public tutor availability and reviews.
router.get("/:slug/extras", getTutorExtras);

// Public individual tutor profile.
router.get("/:slug", getTutorBySlug);

// Export the router.
module.exports = router;
