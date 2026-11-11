
const express = require("express");

const { protect } = require("../middleware/authMiddleware");
const bookingRoutes = require("./routes/bookingRoutes");

app.use("/api/bookings", bookingRoutes);

const {
  getBookings,
  createBooking,
  updateBookingStatus,
} = require("../controllers/bookingController");

const router = express.Router();

router.get("/", protect, getBookings);

router.post("/", protect, createBooking);

router.patch(
  "/:id/status",
  protect,
  updateBookingStatus
);

module.exports = router;
