
const express = require("express");

const {
  protect,
} = require("../middleware/authMiddleware");

const {
  createBooking,
  updateBookingStatus,
  getBookings,
} = require("../controllers/bookingController");

const router = express.Router();

// Retrieve bookings for the logged-in student or tutor.
router.get("/", protect, getBookings);

// Student creates a booking.
router.post("/", protect, createBooking);

// Update booking status.
router.patch(
  "/:id/status",
  protect,
  updateBookingStatus
);

module.exports = router;
