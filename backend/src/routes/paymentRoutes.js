// TuLinkUp payment routes.
// Authentication is required before starting Checkout.

const express = require("express");

const {
  protect,
} = require("../middleware/authMiddleware");

const {
  startCheckout,
} = require("../controllers/paymentController");

const router = express.Router();

// Prevent caching of payment responses.
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// Only authenticated students can initiate Checkout.
// Student role and payment ownership are verified
// by the controller and payment services.
router.post("/checkout", protect, startCheckout);

module.exports = router;
