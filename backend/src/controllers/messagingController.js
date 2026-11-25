"use strict";

const messagingService = require(
  "../services/messagingService"
);

const {
  MessagingError
} = messagingService;

function handleMessagingError(
  error,
  req,
  res,
  next
) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof MessagingError) {
    return res.status(error.status).json({
      success: false,
      message: error.message
    });
  }

  console.error("Messaging operation failed", {
    method: req.method,
    code: error.code || "UNKNOWN_ERROR"
  });

  return res.status(500).json({
    success: false,
    message: "Unable to complete messaging request."
  });
}

function messagingHandler(operation) {
  return async function (req, res, next) {
    res.set("Cache-Control", "no-store");

    try {
      return await operation(req, res);
    } catch (error) {
      return handleMessagingError(
        error,
        req,
        res,
        next
      );
    }
  };
}

function requireRequestBody(req) {
  if (
    !req.body ||
    typeof req.body !== "object" ||
    Array.isArray(req.body)
  ) {
    throw new MessagingError(
      400,
      "Invalid request body."
    );
  }

  return req.body;
}

const createConversation = messagingHandler(
  async (req, res) => {
    const body = requireRequestBody(req);

    const result =
      await messagingService.createConversation(
        req.user,
        body.tutorUserId
      );

    return res.status(
      result.created ? 201 : 200
    ).json({
      success: true,
      ...result
    });
  }
);

const listConversations = messagingHandler(
  async (req, res) => {
    const result =
      await messagingService.listConversations(
        req.user,
        {
          limit: req.query.limit,
          offset: req.query.offset
        }
      );

    return res.status(200).json({
      success: true,
      ...result
    });
  }
);

const getConversation = messagingHandler(
  async (req, res) => {
    const conversation =
      await messagingService.getConversation(
        req.user,
        req.params.id
      );

    return res.status(200).json({
      success: true,
      conversation
    });
  }
);

const getMessages = messagingHandler(
  async (req, res) => {
    const result =
      await messagingService.getMessages(
        req.user,
        req.params.id,
        {
          limit: req.query.limit,
          beforeId: req.query.beforeId
        }
      );

    return res.status(200).json({
      success: true,
      ...result
    });
  }
);

const sendMessage = messagingHandler(
  async (req, res) => {
    const body = requireRequestBody(req);

    const result =
      await messagingService.sendMessage(
        req.user,
        req.params.id,
        {
          body: body.body,
          clientMessageId: body.clientMessageId
        }
      );

    return res.status(
      result.created ? 201 : 200
    ).json({
      success: true,
      ...result
    });
  }
);

const markMessagesRead = messagingHandler(
  async (req, res) => {
    const body = requireRequestBody(req);

    const result =
      await messagingService.markMessagesRead(
        req.user,
        req.params.id,
        body.lastReadMessageId
      );

    return res.status(200).json({
      success: true,
      ...result
    });
  }
);

const getUnreadCount = messagingHandler(
  async (req, res) => {
    const result =
      await messagingService.getUnreadCount(
        req.user
      );

    return res.status(200).json({
      success: true,
      ...result
    });
  }
);

// Block the other conversation participant.
const blockUser = messagingHandler(
  async (req, res) => {
    const result =
      await messagingService.blockUser(
        req.user,
        req.params.id
      );

    return res.status(200).json({
      success: true,
      ...result
    });
  }
);

// Remove only the authenticated user's own block.
const unblockUser = messagingHandler(
  async (req, res) => {
    const result =
      await messagingService.unblockUser(
        req.user,
        req.params.id
      );

    return res.status(200).json({
      success: true,
      ...result
    });
  }
);

// Submit a confidential report about a received message.
const reportMessage = messagingHandler(
  async (req, res) => {
    const body = requireRequestBody(req);

    const result =
      await messagingService.reportMessage(
        req.user,
        req.params.id,
        req.params.messageId,
        {
          reason: body.reason,
          details: body.details
        }
      );

    return res.status(
      result.created ? 201 : 200
    ).json({
      success: true,
      ...result
    });
  }
);

module.exports = {
  reportMessage,
  blockUser,
  unblockUser,
  createConversation,
  listConversations,
  getConversation,
  getMessages,
  sendMessage,
  markMessagesRead,
  getUnreadCount
};
