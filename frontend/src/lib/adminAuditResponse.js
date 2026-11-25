import { validatePagination } from "./adminListResponse";

// Match the actions supported by the backend.
export const AUDIT_ACTIONS = Object.freeze({
  TUTOR_APPROVED: "tutor_profile",
  TUTOR_REJECTED: "tutor_profile",
  ACCOUNT_SUSPENDED: "user",
  ACCOUNT_REACTIVATED: "user",
  ACCOUNT_REMOVED: "user",
  PLATFORM_SETTINGS_UPDATED: "platform_settings",
  BOOKING_CANCELLED_BY_ADMIN: "booking",
  GROUP_CLASS_CANCELLED_BY_ADMIN: "group_class",
});

export const AUDIT_TARGETS = Object.freeze([
  ...new Set(Object.values(AUDIT_ACTIONS)),
]);

const reasons = [
  "ADMINISTRATIVE_REVIEW",
  "VERIFICATION_COMPLETED",
  "VERIFICATION_FAILED",
  "POLICY_VIOLATION",
  "SAFETY_CONCERN",
  "ACCOUNT_REQUEST",
  "ACCOUNT_RESTORED",
  "DUPLICATE_ACCOUNT",
  "PLATFORM_CONFIGURATION",
  "SCHEDULING_ISSUE",
  "SERVICE_UNAVAILABLE",
  "OTHER_ADMINISTRATIVE_REASON",
];

const transitions = {
  TUTOR_APPROVED: [
    "approval_status",
    ["pending", "rejected"],
    "approved",
  ],
  TUTOR_REJECTED: [
    "approval_status",
    ["pending", "approved"],
    "rejected",
  ],
  ACCOUNT_SUSPENDED: [
    "account_status",
    ["active"],
    "suspended",
  ],
  ACCOUNT_REACTIVATED: [
    "account_status",
    ["suspended"],
    "active",
  ],
  ACCOUNT_REMOVED: [
    "account_status",
    ["active", "suspended"],
    "removed",
  ],
  BOOKING_CANCELLED_BY_ADMIN: [
    "status",
    ["pending", "accepted"],
    "cancelled",
  ],
  GROUP_CLASS_CANCELLED_BY_ADMIN: [
    "status",
    ["draft", "published", "live"],
    "cancelled",
  ],
};

function invalid() {
  throw new Error("Invalid administrator audit response.");
}

function validObject(value) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (
      Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null
    );
}

function validId(value) {
  return typeof value === "string" &&
    /^[1-9]\d{0,18}$/.test(value) &&
    BigInt(value) <= 9223372036854775807n;
}

function integerBetween(value, minimum, maximum) {
  return Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum;
}

// Keep sensitive or unsupported settings out of audit responses.
const settingsValidators = {
  currency: value => value === "CAD",

  min_private_hourly_rate_cents: value =>
    integerBetween(value, 0, 2500),

  max_private_hourly_rate_cents: value =>
    integerBetween(value, 0, 2500),

  max_private_students: value => value === 1,

  min_group_price_cents: value =>
    integerBetween(value, 0, 1000),

  max_group_price_cents: value =>
    integerBetween(value, 0, 1000),

  min_group_capacity: value =>
    integerBetween(value, 2, 20),

  max_group_students: value =>
    integerBetween(value, 2, 20),

  max_group_revenue_cents: value =>
    integerBetween(value, 0, 10000),

  platform_commission_percent: value =>
    value === 20,

  tutor_revenue_percent: value =>
    value === 80 || value === null,

  free_tutoring_enabled: value =>
    typeof value === "boolean",

  paid_tutoring_enabled: value =>
    typeof value === "boolean",

  tutor_transfers_enabled: value =>
    typeof value === "boolean",
};

function validateChanges(record) {
  const previous = record.previousValues;
  const next = record.newValues;

  if (!validObject(previous) || !validObject(next)) {
    invalid();
  }

  const keys = Object.keys(previous).sort();

  if (
    keys.length === 0 ||
    JSON.stringify(keys) !==
      JSON.stringify(Object.keys(next).sort()) ||
    !keys.some(key => previous[key] !== next[key])
  ) {
    invalid();
  }

  if (record.action === "PLATFORM_SETTINGS_UPDATED") {
    for (const key of keys) {
      if (
        !Object.hasOwn(settingsValidators, key) ||
        !settingsValidators[key](previous[key]) ||
        !settingsValidators[key](next[key])
      ) {
        invalid();
      }
    }
  } else {
    const [field, allowedPrevious, expectedNext] =
      transitions[record.action];

    if (
      keys.length !== 1 ||
      keys[0] !== field ||
      !allowedPrevious.includes(previous[field]) ||
      next[field] !== expectedNext
    ) {
      invalid();
    }
  }

  return {
    previousValues: Object.fromEntries(
      keys.map(key => [key, previous[key]])
    ),
    newValues: Object.fromEntries(
      keys.map(key => [key, next[key]])
    ),
  };
}

// Validate dates using the same UTC format as the backend.
function validDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith("0000")
  ) {
    return false;
  }

  const date = new Date(value + "T00:00:00.000Z");

  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

export function validateAuditQuery(query) {
  const allowed = [
    "adminId",
    "action",
    "targetType",
    "targetId",
    "startDate",
    "endDate",
    "page",
    "limit",
  ];

  const seen = new Set();

  for (const [key, value] of query) {
    if (
      !allowed.includes(key) ||
      seen.has(key) ||
      value.length === 0
    ) {
      invalid();
    }

    seen.add(key);
  }

  for (const key of ["adminId", "targetId"]) {
    if (query.has(key) && !validId(query.get(key))) {
      invalid();
    }
  }

  for (const [key, maximum] of [
    ["page", 10000],
    ["limit", 100],
  ]) {
    if (query.has(key)) {
      const value = query.get(key);

      if (
        !/^[1-9]\d{0,4}$/.test(value) ||
        !integerBetween(Number(value), 1, maximum)
      ) {
        invalid();
      }
    }
  }

  const action = query.get("action");
  const target = query.get("targetType");

  if (
    (action && !Object.hasOwn(AUDIT_ACTIONS, action)) ||
    (target && !AUDIT_TARGETS.includes(target)) ||
    (action && target && AUDIT_ACTIONS[action] !== target)
  ) {
    invalid();
  }

  const start = query.get("startDate");
  const end = query.get("endDate");

  if (
    (start && !validDate(start)) ||
    (end && !validDate(end)) ||
    (start && end && start > end)
  ) {
    invalid();
  }

  return true;
}

// Validate each audit record and return only approved fields.
function validateRecord(record, query) {
  if (
    !validObject(record) ||
    !validId(record.id) ||
    !validId(record.adminId) ||
    !validId(record.targetId) ||
    !Object.hasOwn(AUDIT_ACTIONS, record.action) ||
    AUDIT_ACTIONS[record.action] !== record.targetType ||
    (
      record.reason !== null &&
      !reasons.includes(record.reason)
    ) ||
    typeof record.requestId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      record.requestId
    ) ||
    typeof record.createdAt !== "string" ||
    !Number.isFinite(Date.parse(record.createdAt)) ||
    new Date(record.createdAt).toISOString() !==
      record.createdAt
  ) {
    invalid();
  }

  for (const key of [
    "adminId",
    "targetId",
    "action",
    "targetType",
  ]) {
    if (query.has(key) && record[key] !== query.get(key)) {
      invalid();
    }
  }

  const date = record.createdAt.slice(0, 10);

  if (
    (query.has("startDate") &&
      date < query.get("startDate")) ||
    (query.has("endDate") &&
      date > query.get("endDate"))
  ) {
    invalid();
  }

  if (
    !validObject(record.metadata) ||
    Object.keys(record.metadata).some(
      key => key !== "source"
    ) ||
    (
      Object.hasOwn(record.metadata, "source") &&
      !["admin_dashboard", "admin_api"].includes(
        record.metadata.source
      )
    )
  ) {
    invalid();
  }

  const changes = validateChanges(record);

  return {
    id: record.id,
    adminId: record.adminId,
    action: record.action,
    targetType: record.targetType,
    targetId: record.targetId,
    ...changes,
    reason: record.reason,
    metadata: Object.hasOwn(record.metadata, "source")
      ? { source: record.metadata.source }
      : {},
    requestId: record.requestId,
    createdAt: record.createdAt,
  };
}

// Reject malformed or inconsistent audit responses.
export function validateAdminAuditResponse(data, query) {
  validateAuditQuery(query);

  if (
    !validObject(data) ||
    data.success !== true ||
    !Array.isArray(data.auditLogs) ||
    data.auditLogs.length > 100
  ) {
    invalid();
  }

  const auditLogs = data.auditLogs.map(
    record => validateRecord(record, query)
  );

  if (
    new Set(auditLogs.map(record => record.id)).size !==
      auditLogs.length
  ) {
    invalid();
  }

  return {
    success: true,
    auditLogs,
    pagination: validatePagination(
      data.pagination,
      query,
      auditLogs.length
    ),
  };
}
