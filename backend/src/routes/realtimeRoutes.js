"use strict";

const express = require("express");

const {
  protect
} = require("../middleware/authMiddleware");

const {
  createSocketTicket
} = require("../realtime/socketTicketService");

const router = express.Router();

// Prevent caching of authentication tickets.
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store, private");
  next();
});

// Require a valid authenticated account.
router.use(protect);

// Issue a temporary real-time authentication ticket.
router.post("/ticket", (req, res) => {
  if (!["student", "tutor"].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Real-time messaging is unavailable for this account."
    });
  }

  try {
    const result = createSocketTicket(req.user);

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch {
    console.error("Socket ticket creation failed.");

    return res.status(500).json({
      success: false,
      message: "Unable to establish real-time messaging."
    });
  }
});

module.exports = router;
