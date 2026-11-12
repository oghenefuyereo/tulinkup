
// Import Express to create routes for managing tutor reviews.
const express = require("express");

// Import the middleware that checks whether a user is logged in.
const { protect } = require("../middleware/authMiddleware");

// Import the functions that handle tutor reviews.
const {
  getTutorReviews,
  createReview,
  updateReview,
  deleteReview,
} = require("../controllers/reviewController");

// Create a router to handle review requests.
const router = express.Router();

// Public route to view reviews for a specific tutor.
router.get("/tutor/:tutorId", getTutorReviews);

// Protected route to allow students to submit reviews.
router.post("/", protect, createReview);

// Protected route to allow students to update their own reviews.
router.put("/:id", protect, updateReview);

// Protected route to allow administrators to delete reviews.
router.delete("/:id", protect, deleteReview);

// Export the router so it can be used in the main server.
module.exports = router;
