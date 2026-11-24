
// Import Express to create routes for the admin dashboard.
const express = require("express");

// Import the middleware that checks for administrator access.
const { requireAdmin } = require("../middleware/adminMiddleware");

// Create a router to handle administrator requests.
const router = express.Router();

// This route must be mounted behind a middleware
// that verifies an admin JWT and sets req.user.

// Allow only administrators to access the dashboard route.
router.get("/dashboard", requireAdmin, (req, res) => {
  // Send a welcome message when an administrator accesses the dashboard.
  res.json({
    success: true,
    message: "Welcome to the TuLinkUp admin dashboard.",
  });
});

// Export the router so it can be used in the main server.
module.exports = router;
