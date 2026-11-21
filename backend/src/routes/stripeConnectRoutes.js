// Import Express to create Stripe Connect routes.
const express = require("express");

// Import the middleware that verifies user authentication.
const { protect } = require("../middleware/authMiddleware");

// Import the Stripe Connect controller functions.
const {
  startOnboarding,
  refreshOnboarding,
  getAccountStatus,
} = require("../controllers/stripeConnectController");

// Create a router for managing tutor payment accounts.
const router = express.Router();

// Prevent payment account responses from being cached.
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// Allow an authenticated tutor to start Stripe onboarding.
router.post("/onboarding", protect, startOnboarding);

// Allow an authenticated tutor to generate a new onboarding link.
router.post(
  "/onboarding/refresh",
  protect,
  refreshOnboarding
);

// Allow an authenticated tutor to retrieve payment account status.
router.get("/status", protect, getAccountStatus);

// Export the Stripe Connect router.
module.exports = router;