"use strict";

const pool = require("../config/db");

class MessagingError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "MessagingError";
    this.status = status;
  }
}

function validateId(value, label = "ID") {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    throw new MessagingError(400, `Invalid ${label}.`);
  }

  if (
    typeof value === "number" &&
    !Number.isSafeInteger(value)
  ) {
    throw new MessagingError(400, `Invalid ${label}.`);
  }

  const id = String(value);

  if (
    !/^[1-9]\d{0,18}$/.test(id) ||
    BigInt(id) > 9223372036854775807n
  ) {
    throw new MessagingError(400, `Invalid ${label}.`);
  }

  return id;
}

async function withTransaction(operation) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await operation(client);

    await client.query("COMMIT");

    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function lockUserPair(client, firstId, secondId) {
  const ids = [firstId, secondId].sort(
    (a, b) => BigInt(a) < BigInt(b) ? -1 :
              BigInt(a) > BigInt(b) ? 1 : 0
  );

  await client.query(
    `SELECT pg_advisory_xact_lock(
       hashtextextended($1::text, 0)
     )`,
    [`messaging:${ids[0]}:${ids[1]}`]
  );
}

async function assertNotBlocked(client, firstId, secondId) {
  const result = await client.query(
    `SELECT 1
     FROM public.user_blocks
     WHERE
       (blocker_id = $1 AND blocked_id = $2)
       OR
       (blocker_id = $2 AND blocked_id = $1)
     LIMIT 1`,
    [firstId, secondId]
  );

  if (result.rowCount > 0) {
    throw new MessagingError(
      403,
      "Messaging is unavailable for this user."
    );
  }
}

async function createConversation(user, tutorUserId) {
  if (!user || user.role !== "student") {
    throw new MessagingError(
      403,
      "Only students can start conversations."
    );
  }

  const studentId = validateId(
    user.userId,
    "student ID"
  );

  const tutorId = validateId(
    tutorUserId,
    "tutor ID"
  );

  if (studentId === tutorId) {
    throw new MessagingError(
      400,
      "You cannot message yourself."
    );
  }

  const result = await withTransaction(async client => {
    await lockUserPair(client, studentId, tutorId);

    const student = await client.query(
      `SELECT id
       FROM public.users
       WHERE id = $1
       AND role = 'student'
       AND account_status = 'active'
       FOR SHARE`,
      [studentId]
    );

    if (student.rowCount !== 1) {
      throw new MessagingError(
        403,
        "Student account is unavailable."
      );
    }

    const tutor = await client.query(
      `SELECT u.id
       FROM public.users u
       JOIN public.tutor_profiles tp
         ON tp.user_id = u.id
       WHERE u.id = $1
       AND u.role = 'tutor'
       AND u.account_status = 'active'
       AND tp.approval_status = 'approved'
       FOR SHARE OF u, tp`,
      [tutorId]
    );

    if (tutor.rowCount !== 1) {
      throw new MessagingError(
        404,
        "Tutor is unavailable."
      );
    }

    await assertNotBlocked(
      client,
      studentId,
      tutorId
    );

    const inserted = await client.query(
      `INSERT INTO public.conversations (
         student_id,
         tutor_id
       )
       VALUES ($1, $2)
       ON CONFLICT (student_id, tutor_id)
       DO NOTHING
       RETURNING
         id,
         student_id,
         tutor_id,
         created_at,
         updated_at`,
      [studentId, tutorId]
    );

    let conversation = inserted.rows[0];
    const created = inserted.rowCount === 1;

    if (!conversation) {
      const existing = await client.query(
        `SELECT
           id,
           student_id,
           tutor_id,
           created_at,
           updated_at
         FROM public.conversations
         WHERE student_id = $1
         AND tutor_id = $2`,
        [studentId, tutorId]
      );

      conversation = existing.rows[0];
    }

    if (!conversation) {
      throw new Error(
        "Unable to resolve conversation."
      );
    }

    await client.query(
      `INSERT INTO public.conversation_participants (
         conversation_id,
         user_id
       )
       VALUES ($1, $2), ($1, $3)
       ON CONFLICT (conversation_id, user_id)
       DO NOTHING`,
      [conversation.id, studentId, tutorId]
    );

    return {
      conversation,
      created
    };
  });

  // Publish only after the transaction has committed.
  if (result.created) {
    try {
      notifyConversationUpdated({
        studentId,
        tutorId,
        conversationId: result.conversation.id
      });
    } catch {
      console.warn(
        "Conversation notification unavailable."
      );
    }
  }

  return result;
}

module.exports = {
  MessagingError,
  validateId,
  withTransaction,
  lockUserPair,
  assertNotBlocked,
  createConversation
};

function requireMessagingUser(user) {
  if (
    !user ||
    !["student", "tutor"].includes(user.role)
  ) {
    throw new MessagingError(
      403,
      "Messaging access is unavailable."
    );
  }

  return validateId(user.userId, "user ID");
}

function validateLimit(value, fallback = 30) {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (
    !["string", "number"].includes(typeof value) ||
    !/^[1-9]\d{0,2}$/.test(String(value))
  ) {
    throw new MessagingError(400, "Invalid limit.");
  }

  const limit = Number(value);

  if (limit > 100) {
    throw new MessagingError(400, "Maximum limit is 100.");
  }

  return limit;
}

const conversationSelect = `
  SELECT
    c.id,
    c.student_id,
    c.tutor_id,
    c.created_at,
    c.updated_at,
    cp.last_read_message_id,

    CASE
      WHEN student.account_status = 'active'
        AND tutor.account_status = 'active'
        AND student.role = 'student'
        AND tutor.role = 'tutor'
        AND EXISTS (
          SELECT 1
          FROM public.tutor_profiles approved
          WHERE approved.user_id = c.tutor_id
          AND approved.approval_status = 'approved'
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
        )
      THEN other_participant.last_read_message_id
      ELSE NULL
    END AS participant_last_read_message_id,

    other_user.id AS participant_id,
    other_user.role AS participant_role,

    COALESCE(
      NULLIF(tp.display_name, ''),
      other_user.full_name
    ) AS participant_name,

    tp.profile_image_url AS participant_image_url,

    latest.id AS last_message_id,
    latest.body AS last_message,
    latest.sender_id AS last_message_sender_id,
    latest.created_at AS last_message_at,

    (
      SELECT COUNT(*)::integer
      FROM public.messages unread
      WHERE unread.conversation_id = c.id
      AND unread.sender_id <> $1
      AND unread.id > COALESCE(
        cp.last_read_message_id, 0
      )
    ) AS unread_count,

    EXISTS (
      SELECT 1
      FROM public.user_blocks ub
      WHERE
        (ub.blocker_id = c.student_id
         AND ub.blocked_id = c.tutor_id)
        OR
        (ub.blocker_id = c.tutor_id
         AND ub.blocked_id = c.student_id)
    ) AS is_blocked,

    EXISTS (
      SELECT 1
      FROM public.user_blocks own_block
      WHERE own_block.blocker_id = $1
      AND own_block.blocked_id = other_user.id
    ) AS blocked_by_me,

    (
      other_user.account_status = 'active'
      AND student.account_status = 'active'
      AND tutor.account_status = 'active'
      AND student.role = 'student'
      AND tutor.role = 'tutor'
      AND EXISTS (
        SELECT 1
        FROM public.tutor_profiles approved
        WHERE approved.user_id = c.tutor_id
        AND approved.approval_status = 'approved'
      )
    ) AS accounts_available

  FROM public.conversations c

  JOIN public.conversation_participants cp
    ON cp.conversation_id = c.id
    AND cp.user_id = $1

  JOIN public.users student
    ON student.id = c.student_id

  JOIN public.users tutor
    ON tutor.id = c.tutor_id

  JOIN public.users other_user
    ON other_user.id = CASE
      WHEN c.student_id = $1 THEN c.tutor_id
      ELSE c.student_id
    END

  LEFT JOIN public.conversation_participants other_participant
    ON other_participant.conversation_id = c.id
    AND other_participant.user_id = other_user.id

  LEFT JOIN public.tutor_profiles tp
    ON tp.user_id = other_user.id
    AND other_user.role = 'tutor'

  LEFT JOIN LATERAL (
    SELECT id, body, sender_id, created_at
    FROM public.messages
    WHERE conversation_id = c.id
    ORDER BY id DESC
    LIMIT 1
  ) latest ON true

  WHERE (
    (c.student_id = $1 AND $2 = 'student')
    OR
    (c.tutor_id = $1 AND $2 = 'tutor')
  )
`;

async function listConversations(user, options = {}) {
  const userId = requireMessagingUser(user);
  const limit = validateLimit(options.limit);

  const offsetValue = options.offset ?? 0;

  if (
    !["string", "number"].includes(typeof offsetValue) ||
    !/^\d{1,6}$/.test(String(offsetValue))
  ) {
    throw new MessagingError(400, "Invalid offset.");
  }

  const offset = Number(offsetValue);

  const result = await pool.query(
    `${conversationSelect}
     ORDER BY c.updated_at DESC, c.id DESC
     LIMIT $3 OFFSET $4`,
    [userId, user.role, limit + 1, offset]
  );

  return {
    conversations: result.rows.slice(0, limit),
    hasMore: result.rows.length > limit,
    nextOffset:
      result.rows.length > limit
        ? offset + limit
        : null
  };
}

async function getConversation(user, conversationId) {
  const userId = requireMessagingUser(user);

  const id = validateId(
    conversationId,
    "conversation ID"
  );

  const result = await pool.query(
    `${conversationSelect}
     AND c.id = $3`,
    [userId, user.role, id]
  );

  if (result.rowCount !== 1) {
    throw new MessagingError(
      404,
      "Conversation not found."
    );
  }

  return result.rows[0];
}

async function getMessages(
  user,
  conversationId,
  options = {}
) {
  const userId = requireMessagingUser(user);

  const id = validateId(
    conversationId,
    "conversation ID"
  );

  const limit = validateLimit(options.limit, 50);

  const beforeId =
    options.beforeId === undefined ||
    options.beforeId === null
      ? null
      : validateId(
          options.beforeId,
          "message cursor"
        );

  await getConversation(user, id);

  const result = await pool.query(
    `SELECT
       m.id,
       m.conversation_id,
       m.sender_id,
       m.client_message_id,
       m.body,
       m.created_at

     FROM public.messages m

     JOIN public.conversations c
       ON c.id = m.conversation_id

     JOIN public.conversation_participants cp
       ON cp.conversation_id = c.id
       AND cp.user_id = $1

     WHERE c.id = $2
     AND (
       (c.student_id = $3 AND $4 = 'student')
       OR
       (c.tutor_id = $3 AND $4 = 'tutor')
     )
     AND (
       $5::bigint IS NULL
       OR m.id < $5::bigint
     )

     ORDER BY m.id DESC
     LIMIT $6`,
    [
      userId,
      id,
      userId,
      user.role,
      beforeId,
      limit + 1
    ]
  );

  const hasMore = result.rows.length > limit;
  const messages = result.rows.slice(0, limit);

  const nextBeforeId =
    hasMore && messages.length
      ? messages[messages.length - 1].id
      : null;

  return {
    messages: messages.reverse(),
    hasMore,
    nextBeforeId
  };
}

Object.assign(module.exports, {
  requireMessagingUser,
  validateLimit,
  listConversations,
  getConversation,
  getMessages
});

function validateMessageBody(value) {
  if (typeof value !== "string") {
    throw new MessagingError(
      400,
      "Message must be text."
    );
  }

  const body = value.trim();

  if (!body || body.includes("\u0000")) {
    throw new MessagingError(
      400,
      "Invalid message content."
    );
  }

  if (Array.from(body).length > 4000) {
    throw new MessagingError(
      400,
      "Message cannot exceed 4000 characters."
    );
  }

  return body;
}

function validateClientMessageId(value) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new MessagingError(
      400,
      "Invalid client message ID."
    );
  }

  return value.toLowerCase();
}

async function requireConversationMembership(
  client,
  user,
  conversationId
) {
  const userId = requireMessagingUser(user);
  const id = validateId(
    conversationId,
    "conversation ID"
  );

  const result = await client.query(
    `SELECT
       c.id,
       c.student_id,
       c.tutor_id,
       cp.last_read_message_id

     FROM public.conversations c

     JOIN public.conversation_participants cp
       ON cp.conversation_id = c.id
       AND cp.user_id = $1

     WHERE c.id = $2
     AND (
       (c.student_id = $1 AND $3 = 'student')
       OR
       (c.tutor_id = $1 AND $3 = 'tutor')
     )`,
    [userId, id, user.role]
  );

  if (result.rowCount !== 1) {
    throw new MessagingError(
      404,
      "Conversation not found."
    );
  }

  return result.rows[0];
}

async function assertMessagingAccountsAvailable(
  client,
  studentId,
  tutorId
) {
  const result = await client.query(
    `SELECT s.id
     FROM public.users s
     JOIN public.users t
       ON t.id = $2
     JOIN public.tutor_profiles tp
       ON tp.user_id = t.id
     WHERE s.id = $1
     AND s.role = 'student'
     AND s.account_status = 'active'
     AND t.role = 'tutor'
     AND t.account_status = 'active'
     AND tp.approval_status = 'approved'
     FOR SHARE OF s, t, tp`,
    [studentId, tutorId]
  );

  if (result.rowCount !== 1) {
    throw new MessagingError(
      403,
      "Messaging is currently unavailable."
    );
  }
}

async function sendMessage(
  user,
  conversationId,
  input = {}
) {
  const userId = requireMessagingUser(user);

  const id = validateId(
    conversationId,
    "conversation ID"
  );

  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    throw new MessagingError(
      400,
      "Invalid message request."
    );
  }

  const body = validateMessageBody(input.body);

  const clientMessageId =
    validateClientMessageId(
      input.clientMessageId
    );

  const result = await withTransaction(async client => {
    let conversation =
      await requireConversationMembership(
        client,
        user,
        id
      );

    // Serialize sending and future blocking
    // operations for the same user pair.
    await lockUserPair(
      client,
      conversation.student_id,
      conversation.tutor_id
    );

    conversation =
      await requireConversationMembership(
        client,
        user,
        id
      );

    await assertMessagingAccountsAvailable(
      client,
      conversation.student_id,
      conversation.tutor_id
    );

    await assertNotBlocked(
      client,
      conversation.student_id,
      conversation.tutor_id
    );

    // Return the existing message on safe retries.
    const existing = await client.query(
      `SELECT
         id,
         conversation_id,
         sender_id,
         client_message_id,
         body,
         created_at
       FROM public.messages
       WHERE conversation_id = $1
       AND sender_id = $2
       AND client_message_id = $3`,
      [id, userId, clientMessageId]
    );

    if (existing.rowCount === 1) {
      if (existing.rows[0].body !== body) {
        throw new MessagingError(
          409,
          "Message ID already used."
        );
      }

      return {
        message: existing.rows[0],
        created: false
      };
    }

    // Tutors may respond only after the student
    // has sent the first message.
    if (user.role === "tutor") {
      const initiated = await client.query(
        `SELECT 1
         FROM public.messages
         WHERE conversation_id = $1
         AND sender_id = $2
         LIMIT 1`,
        [id, conversation.student_id]
      );

      if (initiated.rowCount === 0) {
        throw new MessagingError(
          403,
          "Wait for the student's first message."
        );
      }
    }

    // Serialize rate-limit checks per sender.
    await client.query(
      `SELECT pg_advisory_xact_lock(
         hashtextextended($1::text, 0)
       )`,
      [`messaging-sender:${userId}`]
    );

    const rate = await client.query(
      `SELECT COUNT(*)::integer AS total
       FROM public.messages
       WHERE sender_id = $1
       AND created_at >=
         clock_timestamp() - INTERVAL '1 minute'`,
      [userId]
    );

    if (rate.rows[0].total >= 30) {
      throw new MessagingError(
        429,
        "Too many messages. Please try again shortly."
      );
    }

    const inserted = await client.query(
      `INSERT INTO public.messages (
         conversation_id,
         sender_id,
         client_message_id,
         body,
         created_at
       )
       VALUES ($1, $2, $3, $4, clock_timestamp())
       RETURNING
         id,
         conversation_id,
         sender_id,
         client_message_id,
         body,
         created_at`,
      [id, userId, clientMessageId, body]
    );

    const message = inserted.rows[0];

    await client.query(
      `UPDATE public.conversations
       SET updated_at = GREATEST(updated_at, $2)
       WHERE id = $1`,
      [id, message.created_at]
    );

    return {
      message,
      created: true,
      eventParticipants: {
        studentId: conversation.student_id,
        tutorId: conversation.tutor_id
      }
    };
  });

  // Publish only after the transaction has committed.
  const { eventParticipants, ...response } = result;

  if (response.created && eventParticipants) {
    try {
      notifyMessageCreated({
        studentId: eventParticipants.studentId,
        tutorId: eventParticipants.tutorId,
        conversationId: id,
        messageId: response.message.id
      });
    } catch {
      // A notification failure must not invalidate
      // a successfully committed message.
      console.warn(
        "Message saved but real-time notification unavailable."
      );
    }
  }

  return response;
}

Object.assign(module.exports, {
  validateMessageBody,
  validateClientMessageId,
  requireConversationMembership,
  assertMessagingAccountsAvailable,
  sendMessage
});

async function markMessagesRead(
  user,
  conversationId,
  lastReadMessageId
) {
  const userId = requireMessagingUser(user);

  const id = validateId(
    conversationId,
    "conversation ID"
  );

  const messageId = validateId(
    lastReadMessageId,
    "message ID"
  );

  const result = await withTransaction(async client => {
    let conversation =
      await requireConversationMembership(
        client,
        user,
        id
      );

    await lockUserPair(
      client,
      conversation.student_id,
      conversation.tutor_id
    );

    conversation =
      await requireConversationMembership(
        client,
        user,
        id
      );

    const message = await client.query(
      `SELECT id
       FROM public.messages
       WHERE conversation_id = $1
       AND id = $2`,
      [id, messageId]
    );

    if (message.rowCount !== 1) {
      throw new MessagingError(
        404,
        "Message not found in this conversation."
      );
    }

    const previous = await client.query(
      `SELECT last_read_message_id
       FROM public.conversation_participants
       WHERE conversation_id = $1
       AND user_id = $2
       FOR UPDATE`,
      [id, userId]
    );

    const previousReadId =
      previous.rows[0]?.last_read_message_id || "0";

    // Never move a user's read marker backwards.
    const updated = await client.query(
      `UPDATE public.conversation_participants
       SET last_read_message_id = GREATEST(
         COALESCE(last_read_message_id, 0),
         $3::bigint
       )
       WHERE conversation_id = $1
       AND user_id = $2
       RETURNING last_read_message_id`,
      [id, userId, messageId]
    );

    if (updated.rowCount !== 1) {
      throw new MessagingError(
        404,
        "Conversation membership not found."
      );
    }

    const readId =
      updated.rows[0].last_read_message_id;

    const unread = await client.query(
      `SELECT COUNT(*)::integer AS unread_count
       FROM public.messages
       WHERE conversation_id = $1
       AND sender_id <> $2
       AND id > $3`,
      [id, userId, readId]
    );

    // Determine whether read receipts may be shared.
    const receiptAccess = await client.query(
      `SELECT (
         student.account_status = 'active'
         AND tutor.account_status = 'active'
         AND student.role = 'student'
         AND tutor.role = 'tutor'
         AND EXISTS (
           SELECT 1
           FROM public.tutor_profiles tp
           WHERE tp.user_id = tutor.id
           AND tp.approval_status = 'approved'
         )
         AND NOT EXISTS (
           SELECT 1
           FROM public.user_blocks ub
           WHERE
             (ub.blocker_id = student.id
              AND ub.blocked_id = tutor.id)
             OR
             (ub.blocker_id = tutor.id
              AND ub.blocked_id = student.id)
         )
       ) AS allowed
       FROM public.users student
       CROSS JOIN public.users tutor
       WHERE student.id = $1
       AND tutor.id = $2`,
      [
        conversation.student_id,
        conversation.tutor_id
      ]
    );

    const shareReadReceipt =
      receiptAccess.rows[0]?.allowed === true;

    return {
      conversationId: id,
      lastReadMessageId: readId,
      shareReadReceipt,
      unreadCount: unread.rows[0].unread_count,
      eventParticipants: {
        studentId: conversation.student_id,
        tutorId: conversation.tutor_id
      },
      readAdvanced:
        BigInt(readId) > BigInt(previousReadId)
    };
  });

  // Publish only after the read transaction commits.
  const {
    eventParticipants,
    readAdvanced,
    shareReadReceipt,
    ...response
  } = result;

  if (readAdvanced && eventParticipants) {
    try {
      // Only share read activity with eligible participants.
      if (shareReadReceipt) {
        notifyMessagesRead({
          studentId: eventParticipants.studentId,
          tutorId: eventParticipants.tutorId,
          conversationId: response.conversationId,
          readerId: userId,
          lastReadMessageId: response.lastReadMessageId
        });
      }

      // Always synchronize the reader's own unread count.
      notifyUnreadUpdated(userId);
    } catch {
      console.warn(
        "Real-time read notification unavailable."
      );
    }
  }

  return response;
}

async function getUnreadCount(user) {
  const userId = requireMessagingUser(user);

  const result = await pool.query(
    `SELECT
       COUNT(m.id)::integer AS unread_count,
       COUNT(DISTINCT c.id)::integer
         AS unread_conversations

     FROM public.conversations c

     JOIN public.conversation_participants cp
       ON cp.conversation_id = c.id
       AND cp.user_id = $1

     JOIN public.messages m
       ON m.conversation_id = c.id
       AND m.sender_id <> $1
       AND m.id > COALESCE(
         cp.last_read_message_id, 0
       )

     WHERE (
       (c.student_id = $1 AND $2 = 'student')
       OR
       (c.tutor_id = $1 AND $2 = 'tutor')
     )`,
    [userId, user.role]
  );

  return {
    unreadCount:
      result.rows[0].unread_count,

    unreadConversations:
      result.rows[0].unread_conversations
  };
}

Object.assign(module.exports, {
  markMessagesRead,
  getUnreadCount
});

// Real-time notifications for committed messages.
const {
  notifyMessageCreated,
  notifyConversationUpdated,
  notifyMessagesRead,
  notifyUnreadUpdated
} = require("../realtime/messagingEvents");


// Update only the authenticated participant's
// own blocking relationship.
async function updateUserBlock(
  user,
  conversationId,
  shouldBlock
) {
  const userId = requireMessagingUser(user);

  const id = validateId(
    conversationId,
    "conversation ID"
  );

  const result = await withTransaction(async client => {
    let conversation =
      await requireConversationMembership(
        client,
        user,
        id
      );

    await lockUserPair(
      client,
      conversation.student_id,
      conversation.tutor_id
    );

    // Revalidate membership after acquiring the lock.
    conversation =
      await requireConversationMembership(
        client,
        user,
        id
      );

    // Revalidate the acting account.
    const actor = await client.query(
      `SELECT id
       FROM public.users
       WHERE id = $1
       AND role = $2
       AND account_status = 'active'
       FOR SHARE`,
      [userId, user.role]
    );

    if (actor.rowCount !== 1) {
      throw new MessagingError(
        403,
        "Your account is unavailable."
      );
    }

    const participantId =
      String(conversation.student_id) === userId
        ? String(conversation.tutor_id)
        : String(conversation.student_id);

    if (participantId === userId) {
      throw new MessagingError(
        400,
        "You cannot block yourself."
      );
    }

    let changed;

    if (shouldBlock) {
      const inserted = await client.query(
        `INSERT INTO public.user_blocks (
           blocker_id,
           blocked_id
         )
         VALUES ($1, $2)
         ON CONFLICT (blocker_id, blocked_id)
         DO NOTHING`,
        [userId, participantId]
      );

      changed = inserted.rowCount === 1;
    } else {
      // Never delete the other participant's block.
      const deleted = await client.query(
        `DELETE FROM public.user_blocks
         WHERE blocker_id = $1
         AND blocked_id = $2`,
        [userId, participantId]
      );

      changed = deleted.rowCount === 1;
    }

    // Messaging remains blocked if either
    // participant still has an active block.
    const status = await client.query(
      `SELECT
         EXISTS (
           SELECT 1
           FROM public.user_blocks
           WHERE
             (blocker_id = $1 AND blocked_id = $2)
             OR
             (blocker_id = $2 AND blocked_id = $1)
         ) AS is_blocked,

         EXISTS (
           SELECT 1
           FROM public.user_blocks
           WHERE blocker_id = $1
           AND blocked_id = $2
         ) AS blocked_by_me`,
      [userId, participantId]
    );

    return {
      conversationId: id,
      isBlocked: status.rows[0].is_blocked,
      blockedByMe: status.rows[0].blocked_by_me,
      changed,
      eventParticipants: {
        studentId: conversation.student_id,
        tutorId: conversation.tutor_id
      }
    };
  });

  const {
    eventParticipants,
    ...response
  } = result;

  // Publish only after the database commits.
  // Do not reveal who initiated the block.
  if (response.changed) {
    try {
      notifyConversationUpdated({
        studentId: eventParticipants.studentId,
        tutorId: eventParticipants.tutorId,
        conversationId: response.conversationId
      });
    } catch {
      console.warn(
        "Conversation synchronization unavailable."
      );
    }
  }

  return response;
}

async function blockUser(user, conversationId) {
  return updateUserBlock(
    user,
    conversationId,
    true
  );
}

async function unblockUser(user, conversationId) {
  return updateUserBlock(
    user,
    conversationId,
    false
  );
}

Object.assign(module.exports, {
  blockUser,
  unblockUser
});


// Message reporting and moderation.
const MESSAGE_REPORT_REASONS = new Set([
  "spam",
  "harassment",
  "inappropriate_content",
  "safety_concern",
  "payment_solicitation",
  "other"
]);

const MAX_REPORTS_PER_HOUR = 20;
const MAX_REPORT_DETAILS_LENGTH = 2000;

function validateReportReason(value) {
  if (
    typeof value !== "string" ||
    !MESSAGE_REPORT_REASONS.has(value)
  ) {
    throw new MessagingError(
      400,
      "Please select a valid reporting reason."
    );
  }

  return value;
}

function validateReportDetails(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (
    typeof value !== "string" ||
    value.includes("\u0000") ||
    Array.from(value).length >
      MAX_REPORT_DETAILS_LENGTH
  ) {
    throw new MessagingError(
      400,
      "Report details must contain no more than 2000 characters."
    );
  }

  return value.trim() || null;
}

async function reportMessage(
  user,
  conversationId,
  messageId,
  options = {}
) {
  const reporterId = requireMessagingUser(user);

  const id = validateId(
    conversationId,
    "conversation ID"
  );

  const targetMessageId = validateId(
    messageId,
    "message ID"
  );

  if (
    !options ||
    typeof options !== "object" ||
    Array.isArray(options)
  ) {
    throw new MessagingError(
      400,
      "Invalid report information."
    );
  }

  const reason = validateReportReason(
    options.reason
  );

  const details = validateReportDetails(
    options.details
  );

  return withTransaction(async client => {
    // Serialize report submissions per account.
    // Prevent concurrent requests bypassing rate limits.
    await client.query(
      `SELECT pg_advisory_xact_lock(
         hashtextextended($1, 0)
       )`,
      [`messaging-report:${reporterId}`]
    );

    // Confirm the reporter belongs to this conversation.
    await requireConversationMembership(
      client,
      user,
      id
    );

    // Only the reporting account must remain active.
    // Reporting must remain available when the other
    // participant is blocked or suspended.
    const reporter = await client.query(
      `SELECT id
       FROM public.users
       WHERE id = $1
       AND role = $2
       AND account_status = 'active'
       FOR SHARE`,
      [reporterId, user.role]
    );

    if (reporter.rowCount !== 1) {
      throw new MessagingError(
        403,
        "Reporting is unavailable for this account."
      );
    }

    // Confirm the reported message belongs to the
    // authorized conversation.
    const target = await client.query(
      `SELECT id, sender_id
       FROM public.messages
       WHERE conversation_id = $1
       AND id = $2`,
      [id, targetMessageId]
    );

    if (target.rowCount !== 1) {
      throw new MessagingError(
        404,
        "Message not found."
      );
    }

    // Users cannot report their own messages.
    if (
      String(target.rows[0].sender_id) ===
      String(reporterId)
    ) {
      throw new MessagingError(
        400,
        "You cannot report your own message."
      );
    }

    // Duplicate submissions return the original
    // confirmation without modifying the report.
    const existing = await client.query(
      `SELECT id, created_at
       FROM public.message_reports
       WHERE conversation_id = $1
       AND message_id = $2
       AND reporter_id = $3`,
      [id, targetMessageId, reporterId]
    );

    if (existing.rowCount === 1) {
      return {
        report: existing.rows[0],
        created: false
      };
    }

    // Enforce a database-backed rolling hourly limit.
    const recent = await client.query(
      `SELECT COUNT(*)::integer AS report_count
       FROM public.message_reports
       WHERE reporter_id = $1
       AND created_at >
         clock_timestamp() - INTERVAL '1 hour'`,
      [reporterId]
    );

    if (
      recent.rows[0].report_count >=
      MAX_REPORTS_PER_HOUR
    ) {
      throw new MessagingError(
        429,
        "You have reached the reporting limit. Please try again later."
      );
    }

    const inserted = await client.query(
      `INSERT INTO public.message_reports (
         conversation_id,
         message_id,
         reporter_id,
         reason,
         details,
         status,
         created_at
       )
       VALUES ($1, $2, $3, $4, $5, 'pending',
               clock_timestamp())
       ON CONFLICT (message_id, reporter_id)
       DO NOTHING
       RETURNING id, created_at`,
      [
        id,
        targetMessageId,
        reporterId,
        reason,
        details
      ]
    );

    if (inserted.rowCount === 1) {
      return {
        report: inserted.rows[0],
        created: true
      };
    }

    // Database-level duplicate protection.
    const duplicate = await client.query(
      `SELECT id, created_at
       FROM public.message_reports
       WHERE conversation_id = $1
       AND message_id = $2
       AND reporter_id = $3`,
      [id, targetMessageId, reporterId]
    );

    if (duplicate.rowCount !== 1) {
      throw new MessagingError(
        409,
        "Unable to confirm the report. Please try again."
      );
    }

    return {
      report: duplicate.rows[0],
      created: false
    };
  });

  // No participant notifications are published.
  // Reports remain confidential moderation records.
}

Object.assign(module.exports, {
  reportMessage
});
