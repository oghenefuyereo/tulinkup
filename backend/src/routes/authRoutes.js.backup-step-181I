
// Import Express to create authentication routes.
const express = require("express");

// Import the functions that handle registration, login, and user details.
const {
  register,
  login,
  getMe,
} = require("../controllers/authController");

// Import the middleware that checks whether a user is logged in.
const { protect } = require("../middleware/authMiddleware");

// Create a router to handle authentication requests.
const router = express.Router();

// Public authentication routes
// Allow new users to create an account.
router.post("/register", register);

// Allow registered users to log in to their accounts.
router.post("/login", login);

// Protected current-user route
// Return the logged-in user's information after verifying their token.
router.get("/me", protect, getMe);

// Export the router so it can be used in the main server.
module.exports = router;
