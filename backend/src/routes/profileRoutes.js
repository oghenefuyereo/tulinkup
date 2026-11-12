
// Import Express to create routes for managing user profiles.
const express = require("express");

// Import the middleware that checks whether a user is logged in.
const { protect } = require("../middleware/authMiddleware");

// Import the function that handles profile updates.
const { updateProfile } = require("../controllers/profileController");

// Create a router to handle profile requests.
const router = express.Router();

// Protected route to allow logged-in users to update their profiles.
router.put("/", protect, updateProfile);

// Export the router so it can be used in the main server.
module.exports = router;
