// All messaging requests use the secure same-origin API proxy.

export class MessagingApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "MessagingApiError";
    this.status = status;
  }
}

async function messagingRequest(
  endpoint,
  { method = "GET", body, signal } = {}
) {
  const response = await fetch(
    `/api/messages/${endpoint}`,
    {
      method,
      credentials: "same-origin",
      cache: "no-store",
      signal,
      headers: {
        Accept: "application/json",
        ...(body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {}),
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.success) {
    throw new MessagingApiError(
      data?.message || "Unable to complete messaging request.",
      response.status
    );
  }

  return data;
}

function conversationPath(id) {
  const value = String(id);

  if (
    !/^[1-9]\d{0,18}$/.test(value) ||
    BigInt(value) > 9223372036854775807n
  ) {
    throw new MessagingApiError(
      "Invalid conversation ID.",
      400
    );
  }

  return `conversations/${value}`;
}

export function listConversations({
  limit = 30,
  offset = 0,
  signal,
} = {}) {
  const query = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  return messagingRequest(
    `conversations?${query}`,
    { signal }
  );
}

export function createConversation(tutorUserId) {
  return messagingRequest("conversations", {
    method: "POST",
    body: { tutorUserId },
  });
}

export function getConversation(id, { signal } = {}) {
  return messagingRequest(
    conversationPath(id),
    { signal }
  );
}

export function getMessages(
  id,
  { limit = 50, beforeId, signal } = {}
) {
  const query = new URLSearchParams({
    limit: String(limit),
  });

  if (beforeId != null) {
    query.set("beforeId", String(beforeId));
  }

  return messagingRequest(
    `${conversationPath(id)}/messages?${query}`,
    { signal }
  );
}

export function sendMessage(
  id,
  { body, clientMessageId }
) {
  return messagingRequest(
    `${conversationPath(id)}/messages`,
    {
      method: "POST",
      body: { body, clientMessageId },
    }
  );
}

export function markMessagesRead(id, lastReadMessageId) {
  return messagingRequest(
    `${conversationPath(id)}/read`,
    {
      method: "PATCH",
      body: { lastReadMessageId },
    }
  );
}

export function getUnreadCount({ signal } = {}) {
  return messagingRequest(
    "unread-count",
    { signal }
  );
}


// Update the authenticated user's own blocking relationship.
async function updateConversationBlock(
  conversationId,
  method
) {
  const id = String(conversationId);

  if (
    !/^[1-9][0-9]{0,18}$/.test(id) ||
    BigInt(id) > 9223372036854775807n
  ) {
    throw new Error("Invalid conversation ID.");
  }

  const response = await fetch(
    `/api/messages/conversations/${id}/block`,
    {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(20000),
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok || data?.success !== true) {
    throw new Error(
      data?.message ||
      "Unable to update blocking preferences."
    );
  }

  if (
    String(data.conversationId) !== id ||
    typeof data.isBlocked !== "boolean" ||
    typeof data.blockedByMe !== "boolean" ||
    typeof data.changed !== "boolean" ||
    (data.blockedByMe && !data.isBlocked)
  ) {
    throw new Error(
      "Invalid blocking confirmation."
    );
  }

  return data;
}

export function blockUser(conversationId) {
  return updateConversationBlock(
    conversationId,
    "POST"
  );
}

export function unblockUser(conversationId) {
  return updateConversationBlock(
    conversationId,
    "DELETE"
  );
}


// Supported message reporting categories.
export const MESSAGE_REPORT_REASONS = Object.freeze([
  {
    value: "spam",
    label: "Spam or unwanted messages",
  },
  {
    value: "harassment",
    label: "Harassment or bullying",
  },
  {
    value: "inappropriate_content",
    label: "Inappropriate content",
  },
  {
    value: "safety_concern",
    label: "Safety concern",
  },
  {
    value: "payment_solicitation",
    label: "Unauthorized payment solicitation",
  },
  {
    value: "other",
    label: "Other",
  },
].map(Object.freeze));

function validateReportingId(value, label) {
  if (
    typeof value !== "string" &&
    !Number.isSafeInteger(value)
  ) {
    throw new Error(`Invalid ${label}.`);
  }

  const id = String(value);

  if (
    !/^[1-9][0-9]{0,18}$/.test(id) ||
    BigInt(id) > 9223372036854775807n
  ) {
    throw new Error(`Invalid ${label}.`);
  }

  return id;
}

export async function reportMessage(
  conversationId,
  messageId,
  { reason, details = "" } = {}
) {
  const id = validateReportingId(
    conversationId,
    "conversation ID"
  );

  const targetId = validateReportingId(
    messageId,
    "message ID"
  );

  if (
    !MESSAGE_REPORT_REASONS.some(
      item => item.value === reason
    )
  ) {
    throw new Error(
      "Please select a valid reporting reason."
    );
  }

  if (
    typeof details !== "string" ||
    details.includes("\u0000") ||
    Array.from(details).length > 2000
  ) {
    throw new Error(
      "Report details must contain no more than 2000 characters."
    );
  }

  const response = await fetch(
    `/api/messages/conversations/${id}/messages/${targetId}/report`,
    {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reason,
        details: details.trim() || null,
      }),
      signal: AbortSignal.timeout(20000),
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok || data?.success !== true) {
    throw new Error(
      data?.message ||
      "Unable to submit your report. Please try again."
    );
  }

  if (
    !data.report ||
    typeof data.created !== "boolean" ||
    typeof data.report.created_at !== "string" ||
    !Number.isFinite(Date.parse(data.report.created_at)) ||
    response.status !== (data.created ? 201 : 200)
  ) {
    throw new Error(
      "Unable to confirm your report. Please try again."
    );
  }

  const reportId = validateReportingId(
    data.report.id,
    "report ID"
  );

  return {
    report: {
      id: reportId,
      created_at: data.report.created_at,
    },
    created: data.created,
  };
}
