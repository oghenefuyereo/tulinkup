"use strict";

const pool = require("../config/db");

const TYPING_EVENTS = Object.freeze({
  UPDATE: "messaging:typing-update",
  STATUS: "messaging:typing-status"
});

const MIN_EVENT_INTERVAL_MS = 1000;
const TYPING_EXPIRY_MS = 3000;

function validateConversationId(value) {
  if (
    typeof value !== "string" ||
    !/^[1-9][0-9]{0,18}$/.test(value) ||
    BigInt(value) > 9223372036854775807n
  ) {
    return null;
  }

  return value;
}

async function getAuthorizedRecipient(
  user,
  conversationId
) {
  const result = await pool.query(
    `SELECT
       CASE
         WHEN c.student_id = $1 THEN c.tutor_id
         ELSE c.student_id
       END AS recipient_id

     FROM public.conversations c

     JOIN public.conversation_participants cp
       ON cp.conversation_id = c.id
       AND cp.user_id = $1

     JOIN public.users s
       ON s.id = c.student_id

     JOIN public.users t
       ON t.id = c.tutor_id

     JOIN public.tutor_profiles tp
       ON tp.user_id = t.id

     WHERE c.id = $2

     AND (
       (c.student_id = $1 AND $3 = 'student')
       OR
       (c.tutor_id = $1 AND $3 = 'tutor')
     )

     AND s.role = 'student'
     AND s.account_status = 'active'

     AND t.role = 'tutor'
     AND t.account_status = 'active'

     AND tp.approval_status = 'approved'

     AND (
       $3 = 'student'
       OR EXISTS (
         SELECT 1
         FROM public.messages m
         WHERE m.conversation_id = c.id
         AND m.sender_id = c.student_id
       )
     )

     AND EXISTS (
       SELECT 1
       FROM public.conversation_participants recipient
       WHERE recipient.conversation_id = c.id
       AND recipient.user_id = CASE
         WHEN c.student_id = $1 THEN c.tutor_id
         ELSE c.student_id
       END
     )

     AND NOT EXISTS (
       SELECT 1
       FROM public.user_blocks ub
       WHERE
         (ub.blocker_id = c.student_id
          AND ub.blocked_id = c.tutor_id)
         OR
         (ub.blocker_id = c.tutor_id
          AND ub.blocked_id = c.student_id)
     )`,
    [
      user.userId,
      conversationId,
      user.role
    ]
  );

  if (result.rowCount !== 1) {
    return null;
  }

  return String(result.rows[0].recipient_id);
}

function registerTypingEvents(io, socket) {
  const user = socket.data.user;

  if (
    !user ||
    !["student", "tutor"].includes(user.role)
  ) {
    return;
  }

  let lastEventAt = 0;
  let processing = false;

  socket.on(
    TYPING_EVENTS.UPDATE,
    async payload => {
      if (
        !socket.connected ||
        !payload ||
        typeof payload !== "object" ||
        Array.isArray(payload)
      ) {
        return;
      }

      const conversationId =
        validateConversationId(
          payload.conversationId
        );

      if (
        !conversationId ||
        typeof payload.isTyping !== "boolean"
      ) {
        return;
      }

      const now = Date.now();

      if (
        processing ||
        now - lastEventAt < MIN_EVENT_INTERVAL_MS
      ) {
        return;
      }

      lastEventAt = now;
      processing = true;

      try {
        const recipientId =
          await getAuthorizedRecipient(
            user,
            conversationId
          );

        if (
          !recipientId ||
          !socket.connected
        ) {

          return;
        }


        io.to(`user:${recipientId}`).emit(
          TYPING_EVENTS.STATUS,
          {
            conversationId,
            userId: String(user.userId),
            isTyping: payload.isTyping,
            expiresInMs: payload.isTyping
              ? TYPING_EXPIRY_MS
              : 0
          }
        );

      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.warn(
            "[Typing] Authorization failed:",
            error.code || error.name
          );
        }

        // Fail closed without exposing private data.
      } finally {
        processing = false;
      }
    }
  );
}

module.exports = {
  TYPING_EVENTS,
  registerTypingEvents
};
