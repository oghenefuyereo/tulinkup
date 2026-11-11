
const express = require("express");

const { requireAdmin } = require("../middleware/adminMiddleware");

const router = express.Router();

// This route must be mounted behind a middleware
// that verifies an admin JWT and sets req.user.

router.get("/dashboard", requireAdmin, (req, res) => {
  res.json({
    success: true,
    message: "Welcome to the TuLinkUp admin dashboard.",
  });
});

module.exports = router;
