"use strict";

const express = require("express");

const {
  protect
} = require("../middleware/authMiddleware");

const controller = require(
  "../controllers/messagingController"
);

const router = express.Router();

// Prevent caching of private messaging responses.
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// Require authentication for every messaging endpoint.
router.use(protect);

// Restrict messaging to students and tutors.
router.use((req, res, next) => {
  if (
    !req.user ||
    !["student", "tutor"].includes(req.user.role)
  ) {
    return res.status(403).json({
      success: false,
      message: "Messaging access is unavailable."
    });
  }

  next();
});

// Total unread message count.
router.get(
  "/unread-count",
  controller.getUnreadCount
);

// Create a student-initiated conversation.
router.post(
  "/conversations",
  controller.createConversation
);

// Retrieve conversation inbox.
router.get(
  "/conversations",
  controller.listConversations
);

// Retrieve a specific conversation.
router.get(
  "/conversations/:id",
  controller.getConversation
);

// Retrieve message history.
router.get(
  "/conversations/:id/messages",
  controller.getMessages
);

// Send a private message.
router.post(
  "/conversations/:id/messages",
  controller.sendMessage
);

// Update individual read markers.
router.patch(
  "/conversations/:id/read",
  controller.markMessagesRead
);

// Block the other conversation participant.
router.post(
  "/conversations/:id/block",
  controller.blockUser
);

// Remove the authenticated user's own block.
router.delete(
  "/conversations/:id/block",
  controller.unblockUser
);

// Submit a confidential message report.
router.post(
  "/conversations/:id/messages/:messageId/report",
  controller.reportMessage
);

module.exports = router;
