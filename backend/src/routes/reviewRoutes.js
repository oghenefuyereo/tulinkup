
const express = require("express");

const { protect } = require("../middleware/authMiddleware");

const {
  getTutorReviews,
  createReview,
  updateReview,
  deleteReview,
} = require("../controllers/reviewController");

const router = express.Router();

router.get("/tutor/:tutorId", getTutorReviews);

router.post("/", protect, createReview);

router.put("/:id", protect, updateReview);

router.delete("/:id", protect, deleteReview);

module.exports = router;
