"use strict";

const {
  getSocketServer
} = require("./socketServer");

const MESSAGING_EVENTS = Object.freeze({
  MESSAGE_CREATED: "messaging:message-created",
  CONVERSATION_UPDATED: "messaging:conversation-updated",
  MESSAGES_READ: "messaging:messages-read",
  UNREAD_UPDATED: "messaging:unread-updated"
});

// Validate database identifiers without losing
// PostgreSQL BIGINT precision.
function validateEventId(value) {
  const id = String(value);

  if (
    !/^[1-9][0-9]{0,18}$/.test(id) ||
    BigInt(id) > 9223372036854775807n
  ) {
    throw new Error("Invalid messaging event ID.");
  }

  return id;
}

// Publish only to server-controlled private rooms.
// Notification failures must not invalidate
// successfully committed database transactions.
function publishMessagingEvent(
  event,
  userIds,
  payload
) {
  try {
    if (
      !Object.values(MESSAGING_EVENTS).includes(event) ||
      !Array.isArray(userIds) ||
      userIds.length === 0 ||
      userIds.length > 2
    ) {
      throw new Error("Invalid messaging event.");
    }

    const rooms = [
      ...new Set(
        userIds.map(
          id => `user:${validateEventId(id)}`
        )
      )
    ];

    const io = getSocketServer();

    io.to(rooms).emit(event, payload);

    return true;
  } catch {
    console.warn(
      "Real-time messaging notification unavailable."
    );

    return false;
  }
}

// Notify both participants of a committed message.
// Never include private message content.
function notifyMessageCreated({
  studentId,
  tutorId,
  conversationId,
  messageId
}) {
  try {
    return publishMessagingEvent(
      MESSAGING_EVENTS.MESSAGE_CREATED,
      [studentId, tutorId],
      {
        conversationId: validateEventId(conversationId),
        messageId: validateEventId(messageId)
      }
    );
  } catch {
    return false;
  }
}

// Notify participants that conversation data changed.
function notifyConversationUpdated({
  studentId,
  tutorId,
  conversationId
}) {
  try {
    return publishMessagingEvent(
      MESSAGING_EVENTS.CONVERSATION_UPDATED,
      [studentId, tutorId],
      {
        conversationId: validateEventId(conversationId)
      }
    );
  } catch {
    return false;
  }
}

// Notify participants of a committed read marker.
function notifyMessagesRead({
  studentId,
  tutorId,
  conversationId,
  readerId,
  lastReadMessageId
}) {
  try {
    const reader = validateEventId(readerId);

    if (
      reader !== validateEventId(studentId) &&
      reader !== validateEventId(tutorId)
    ) {
      return false;
    }

    return publishMessagingEvent(
      MESSAGING_EVENTS.MESSAGES_READ,
      [studentId, tutorId],
      {
        conversationId: validateEventId(conversationId),
        readerId: reader,
        lastReadMessageId:
          validateEventId(lastReadMessageId)
      }
    );
  } catch {
    return false;
  }
}

// Request an unread-count refresh for one account.
function notifyUnreadUpdated(userId) {
  return publishMessagingEvent(
    MESSAGING_EVENTS.UNREAD_UPDATED,
    [userId],
    {}
  );
}

module.exports = {
  MESSAGING_EVENTS,
  notifyMessageCreated,
  notifyConversationUpdated,
  notifyMessagesRead,
  notifyUnreadUpdated
};
