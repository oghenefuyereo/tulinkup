
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
const availabilityRoutes = require("./routes/availabilityRoutes");

app.use("/api/availability", availabilityRoutes);

// Public: view a tutor's available times
router.get("/tutor/:tutorId", getTutorAvailability);

// Protected: tutor manages their own availability
router.get("/me", protect, getMyAvailability);

router.post("/", protect, createAvailability);

router.put("/:id", protect, updateAvailability);

router.delete("/:id", protect, deleteAvailability);

module.exports = router;

