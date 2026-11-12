
// Import Express to create routes for managing user accounts.
const express = require("express");

// Import the middleware that checks whether a user is logged in.
const { protect } = require("../middleware/authMiddleware");

// Import the functions that handle user account requests.
const {
  getMyAccount,
  updateMyAccount,
} = require("../controllers/userController");

// Create a router to handle user account requests.
const router = express.Router();

// Protected route to get the logged-in user's account information.
router.get("/me", protect, getMyAccount);

// Protected route to allow users to update their own account information.
router.put("/me", protect, updateMyAccount);

// Export the router so it can be used in the main server.
module.exports = router;
