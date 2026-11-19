// Import Express.
const express = require("express");

// Import the authentication middleware.
const { protect } = require("../middleware/authMiddleware");

// Import the live session controllers.
const {
  startSession,
  joinSession,
  endSession,
  getSessionStatus,
} = require("../controllers/liveSessionController");

// Initialize the Express router.
const router = express.Router();

// Allow an authorized tutor to start a classroom.
router.post("/start", protect, startSession);

// Allow an authorized participant to join a classroom.
router.post("/join", protect, joinSession);

// Allow the assigned tutor to end a classroom.
router.post("/end", protect, endSession);

// Retrieve the current classroom status.
router.get("/:type/:id", protect, getSessionStatus);

// Export the live session routes.
module.exports = router;