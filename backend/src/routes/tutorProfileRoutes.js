
const express = require("express");

const { protect } = require("../middleware/authMiddleware");

const {
  getTutorProfiles,
  getTutorProfileBySlug,
  createTutorProfile,
  updateTutorProfile,
  deleteTutorProfile,
} = require("../controllers/tutorProfileController");

const router = express.Router();

router.get("/", getTutorProfiles);

router.get("/:slug", getTutorProfileBySlug);

router.post("/", protect, createTutorProfile);

router.put("/:id", protect, updateTutorProfile);

router.delete("/:id", protect, deleteTutorProfile);

module.exports = router;
