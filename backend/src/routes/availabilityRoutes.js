
const express = require("express");

const { protect } = require("../middleware/authMiddleware");

const {
  getMyAvailability,
  createAvailability,
  updateAvailability,
  deleteAvailability,
  getTutorAvailability,
} = require("../controllers/availabilityController");

const router = express.Router();

router.get("/tutor/:tutorId", getTutorAvailability);

router.get("/me", protect, getMyAvailability);

router.post("/", protect, createAvailability);

router.put("/:id", protect, updateAvailability);

router.delete("/:id", protect, deleteAvailability);

module.exports = router;
