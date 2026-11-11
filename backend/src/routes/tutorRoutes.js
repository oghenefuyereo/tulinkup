
const express = require("express");

const {
  protect,
} = require("../middleware/authMiddleware");

const {
  getMyTutorProfile,
} = require("../controllers/tutorController");

const router = express.Router();

router.get("/me/profile", protect, getMyTutorProfile);

module.exports = router;
