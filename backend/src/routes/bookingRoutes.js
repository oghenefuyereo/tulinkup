
// Import Express to create routes for managing bookings.
const express = require("express");

// Import the middleware that checks whether a user is logged in.
const { protect } = require("../middleware/authMiddleware");

// Import the functions that handle booking requests.
const {
  getBookings,
  createBooking,
  updateBookingStatus,
} = require("../controllers/bookingController");

// Create a router to handle booking requests.
const router = express.Router();

// Protected route to get bookings for the logged-in user.
router.get("/", protect, getBookings);

// Protected route to allow a user to create a new booking.
router.post("/", protect, createBooking);

// Protected route to update the status of an existing booking.
router.patch("/:id/status", protect, updateBookingStatus);

// Export the router so it can be used in the main server.
module.exports = router;
