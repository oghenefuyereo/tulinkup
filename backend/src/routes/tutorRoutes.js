const express = require("express");

const { protect } = require("../middleware/authMiddleware");

const {
  getMyTutorProfile,
  getTutors,
  getTutorBySlug,
  getTutorExtras,
} = require("../controllers/tutorController");

const router = express.Router();

// Private tutor dashboard profile
router.get("/me/profile", protect, getMyTutorProfile);

// Public tutor discovery
router.get("/", getTutors);

// Public tutor profile and additional details
router.get("/:slug/extras", getTutorExtras);
router.get("/:slug", getTutorBySlug);

module.exports = router;