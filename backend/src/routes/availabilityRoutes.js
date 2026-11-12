
// Import Express to create routes for tutor availability.
const express = require("express");

// Import the middleware that checks whether a user is logged in.
const { protect } = require("../middleware/authMiddleware");

// Import the functions that manage tutor availability.
const {
  getMyAvailability,
  createAvailability,
  updateAvailability,
  deleteAvailability,
  getTutorAvailability,
} = require("../controllers/availabilityController");

// Create a router to handle availability requests.
const router = express.Router();

// Public route to view a specific tutor's available time slots.
router.get("/tutor/:tutorId", getTutorAvailability);

// Protected route to get the logged-in tutor's availability.
router.get("/me", protect, getMyAvailability);

// Protected route to allow a tutor to add a new available time slot.
router.post("/", protect, createAvailability);

// Protected route to update an existing availability slot.
router.put("/:id", protect, updateAvailability);

// Protected route to delete an availability slot.
router.delete("/:id", protect, deleteAvailability);

// Export the router so it can be used in the main server.
module.exports = router;
