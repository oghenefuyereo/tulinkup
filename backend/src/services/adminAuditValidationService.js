"use strict";

const { randomUUID } = require("node:crypto");

// Define the actions supported by the administrator audit log.
const ACTION_TARGETS = Object.freeze({
  TUTOR_APPROVED: "tutor_profile",
  TUTOR_REJECTED: "tutor_profile",
  ACCOUNT_SUSPENDED: "user",
  ACCOUNT_REACTIVATED: "user",
  ACCOUNT_REMOVED: "user",
  PLATFORM_SETTINGS_UPDATED: "platform_settings",
  BOOKING_CANCELLED_BY_ADMIN: "booking",
  GROUP_CLASS_CANCELLED_BY_ADMIN: "group_class",
  MESSAGE_REPORT_VIEWED: "message_report",
  MESSAGE_REPORT_REVIEW_STARTED: "message_report",
  MESSAGE_REPORT_RESOLVED: "message_report",
  MESSAGE_REPORT_DISMISSED: "message_report",
});

const APPROVAL_STATUSES = Object.freeze([
  "pending",
  "approved",
  "rejected",
]);

const ACCOUNT_STATUSES = Object.freeze([
  "active",
  "suspended",
  "removed",
]);

const BOOKING_STATUSES = Object.freeze([
  "pending",
  "accepted",
  "declined",
  "cancelled",
  "completed",
]);

const GROUP_CLASS_STATUSES = Object.freeze([
  "draft",
  "published",
  "live",
  "completed",
  "cancelled",
]);

// Keep audit reasons predictable and free of personal information.
const REASON_CODES = Object.freeze([
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
]);

const INPUT_FIELDS = Object.freeze([
  "adminId",
  "action",
  "targetType",
  "targetId",
  "previousValues",
  "newValues",
  "reason",
  "metadata",
  "requestId",
]);

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = "INVALID_ADMIN_AUDIT";
  return error;
}

// Accept only canonical positive PostgreSQL identifiers.
function validateAuditId(value) {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    throw validationError("Invalid audit identifier.");
  }

  if (
    typeof value === "number" &&
    (!Number.isSafeInteger(value) || value <= 0)
  ) {
    throw validationError("Invalid audit identifier.");
  }

  const id = String(value);

  if (
    !/^[1-9]\d{0,18}$/.test(id) ||
    BigInt(id) > 9223372036854775807n
  ) {
    throw validationError("Invalid audit identifier.");
  }

  return id;
}

// Reject unexpected properties, getters and non-plain objects.
function validateObject(value, allowedFields) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw validationError("Invalid audit object.");
  }

  const prototype = Object.getPrototypeOf(value);

  if (
    prototype !== Object.prototype &&
    prototype !== null
  ) {
    throw validationError("Invalid audit object.");
  }

  const result = Object.create(null);

  for (const key of Reflect.ownKeys(value)) {
    if (
      typeof key !== "string" ||
      !allowedFields.includes(key)
    ) {
      throw validationError("Unsupported audit field.");
    }

    const descriptor = Object.getOwnPropertyDescriptor(
      value,
      key
    );

    if (
      !descriptor ||
      !descriptor.enumerable ||
      !Object.hasOwn(descriptor, "value")
    ) {
      throw validationError("Invalid audit property.");
    }

    result[key] = descriptor.value;
  }

  return result;
}

function validateEnum(value, allowedValues) {
  if (
    typeof value !== "string" ||
    !allowedValues.includes(value)
  ) {
    throw validationError("Invalid audit field value.");
  }

  return value;
}

function validateInteger(value, minimum, maximum) {
  if (
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw validationError("Invalid audit numeric value.");
  }

  return value;
}

function validateBoolean(value) {
  if (typeof value !== "boolean") {
    throw validationError("Invalid audit boolean value.");
  }

  return value;
}

// Allow only the platform settings needed for administrative history.
const SETTINGS_VALIDATORS = Object.freeze({
  currency: value => validateEnum(value, ["CAD"]),

  min_private_hourly_rate_cents: value =>
    validateInteger(value, 0, 2500),

  max_private_hourly_rate_cents: value =>
    validateInteger(value, 0, 2500),

  max_private_students: value =>
    validateInteger(value, 1, 1),

  min_group_price_cents: value =>
    validateInteger(value, 0, 1000),

  max_group_price_cents: value =>
    validateInteger(value, 0, 1000),

  min_group_capacity: value =>
    validateInteger(value, 2, 20),

  max_group_students: value =>
    validateInteger(value, 2, 20),

  max_group_revenue_cents: value =>
    validateInteger(value, 0, 10000),

  platform_commission_percent: value =>
    validateInteger(value, 20, 20),

  tutor_revenue_percent: value =>
    value === null
      ? null
      : validateInteger(value, 80, 80),

  free_tutoring_enabled: validateBoolean,
  paid_tutoring_enabled: validateBoolean,
  tutor_transfers_enabled: validateBoolean,
});

function getSnapshotValidators(targetType) {
  switch (targetType) {
    case "tutor_profile":
      return {
        approval_status: value =>
          validateEnum(value, APPROVAL_STATUSES),
      };

    case "user":
      return {
        account_status: value =>
          validateEnum(value, ACCOUNT_STATUSES),
      };

    case "booking":
      return {
        status: value =>
          validateEnum(value, BOOKING_STATUSES),
      };

    case "group_class":
      return {
        status: value =>
          validateEnum(value, GROUP_CLASS_STATUSES),
      };

    case "message_report":
      return {
        status: value =>
          validateEnum(value, [
            "pending",
            "reviewing",
            "resolved",
            "dismissed",
          ]),
      };

    case "platform_settings":
      return SETTINGS_VALIDATORS;

    default:
      throw validationError("Invalid audit target type.");
  }
}

// Build a clean snapshot using only approved fields.
function validateSnapshot(value, targetType) {
  const validators = getSnapshotValidators(targetType);

  const snapshot = validateObject(
    value,
    Object.keys(validators)
  );

  const keys = Object.keys(snapshot);

  if (keys.length === 0) {
    throw validationError("Audit snapshot cannot be empty.");
  }

  const result = {};

  for (const key of keys) {
    result[key] = validators[key](snapshot[key]);
  }

  return result;
}

// Ensure the recorded changes match the administrative action.
function validateChanges(action, previousValues, newValues) {
  const previousKeys = Object.keys(previousValues).sort();
  const newKeys = Object.keys(newValues).sort();

  if (
    JSON.stringify(previousKeys) !== JSON.stringify(newKeys)
  ) {
    throw validationError("Audit snapshot fields must match.");
  }

  // Viewing confidential content is an access event,
  // not a report status mutation.
  if (action === "MESSAGE_REPORT_VIEWED") {
    if (
      previousKeys.length !== 1 ||
      previousKeys[0] !== "status" ||
      previousValues.status !== newValues.status
    ) {
      throw validationError(
        "Invalid message report access audit."
      );
    }

    return;
  }

  const changed = previousKeys.some(
    key => previousValues[key] !== newValues[key]
  );

  if (!changed) {
    throw validationError("Audit action must record a change.");
  }

  const transitions = {
    MESSAGE_REPORT_REVIEW_STARTED: [
      "status",
      ["pending"],
      "reviewing",
    ],

    MESSAGE_REPORT_RESOLVED: [
      "status",
      ["reviewing"],
      "resolved",
    ],

    MESSAGE_REPORT_DISMISSED: [
      "status",
      ["reviewing"],
      "dismissed",
    ],
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

  if (Object.hasOwn(transitions, action)) {
    const [field, previousStatuses, newStatus] =
      transitions[action];

    if (
      !previousStatuses.includes(previousValues[field]) ||
      newValues[field] !== newStatus
    ) {
      throw validationError("Invalid audit status transition.");
    }
  }
}

function validateReason(value) {
  if (value === undefined || value === null) {
    return null;
  }

  return validateEnum(value, REASON_CODES);
}

// Keep metadata limited to predefined operational information.
function validateMetadata(value) {
  if (value === undefined) {
    return {};
  }

  const metadata = validateObject(value, ["source"]);
  const result = {};

  if (Object.hasOwn(metadata, "source")) {
    result.source = validateEnum(metadata.source, [
      "admin_dashboard",
      "admin_api",
    ]);
  }

  return result;
}

function validateRequestId(value) {
  if (value === undefined) {
    return randomUUID();
  }

  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw validationError("Invalid audit request ID.");
  }

  return value.toLowerCase();
}

function validatePayloadSize(value, maximumBytes) {
  const bytes = Buffer.byteLength(
    JSON.stringify(value),
    "utf8"
  );

  if (bytes > maximumBytes) {
    throw validationError("Audit payload is too large.");
  }
}

// Validate the complete record before it reaches the database.
function validateAdminAudit(input) {
  const data = validateObject(input, INPUT_FIELDS);

  const adminId = validateAuditId(data.adminId);
  const targetId = validateAuditId(data.targetId);

  if (
    typeof data.action !== "string" ||
    !Object.hasOwn(ACTION_TARGETS, data.action)
  ) {
    throw validationError("Unsupported administrator action.");
  }

  const action = data.action;
  const targetType = ACTION_TARGETS[action];

  if (data.targetType !== targetType) {
    throw validationError("Audit action and target do not match.");
  }

  const previousValues = validateSnapshot(
    data.previousValues,
    targetType
  );

  const newValues = validateSnapshot(
    data.newValues,
    targetType
  );

  validateChanges(action, previousValues, newValues);

  const reason = validateReason(data.reason);
  const metadata = validateMetadata(data.metadata);
  const requestId = validateRequestId(data.requestId);

  validatePayloadSize(previousValues, 16384);
  validatePayloadSize(newValues, 16384);
  validatePayloadSize(metadata, 8192);

  return {
    adminId,
    action,
    targetType,
    targetId,
    previousValues,
    newValues,
    reason,
    metadata,
    requestId,
  };
}

module.exports = {
  ACTION_TARGETS,
  REASON_CODES,
  validateAuditId,
  validateAdminAudit,
};
