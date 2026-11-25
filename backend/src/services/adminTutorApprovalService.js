"use strict";

const {
  validateAdminId,
  withAdminTransaction,
} = require("./adminTransactionService");

const {
  validateAuditId,
  validateAdminAudit,
  REASON_CODES,
} = require("./adminAuditValidationService");

const {
  recordAdminAudit,
} = require("./adminAuditService");

const approvalStatuses = [
  "pending",
  "approved",
  "rejected",
];

function approvalError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// Validate the administrator's decision before accessing the database.
function validateApprovalInput(input) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    throw approvalError("Invalid tutor approval request.");
  }

  const allowedFields = [
    "adminId",
    "profileId",
    "status",
    "expectedStatus",
    "reason",
  ];

  const prototype = Object.getPrototypeOf(input);

  if (
    prototype !== Object.prototype &&
    prototype !== null
  ) {
    throw approvalError("Invalid tutor approval request.");
  }

  const data = Object.create(null);

  for (const key of Reflect.ownKeys(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(
      input,
      key
    );

    if (
      !allowedFields.includes(key) ||
      !descriptor.enumerable ||
      !Object.hasOwn(descriptor, "value")
    ) {
      throw approvalError("Unsupported approval field.");
    }

    data[key] = descriptor.value;
  }

  const adminId = validateAdminId(data.adminId);
  const profileId = validateAuditId(data.profileId);

  if (!["approved", "rejected"].includes(data.status)) {
    throw approvalError("Invalid approval decision.");
  }

  if (!approvalStatuses.includes(data.expectedStatus)) {
    throw approvalError("Invalid expected approval status.");
  }

  if (!REASON_CODES.includes(data.reason)) {
    throw approvalError("A valid administrative reason is required.");
  }

  return {
    adminId,
    profileId,
    status: data.status,
    expectedStatus: data.expectedStatus,
    reason: data.reason,
  };
}

// Update the tutor's approval status and record the administrator's decision.
async function updateTutorApproval(input, database) {
  const decision = validateApprovalInput(input);

  return withAdminTransaction(
    decision.adminId,
    async (client, adminId) => {
      // Find the account associated with the tutor profile.
      const reference = await client.query(
        `SELECT user_id
         FROM public.tutor_profiles
         WHERE id = $1::bigint`,
        [decision.profileId]
      );

      if (reference.rows.length !== 1) {
        throw approvalError("Tutor profile not found.", 404);
      }

      const userId = validateAuditId(
        reference.rows[0].user_id
      );

      // Lock the account before locking its profile.
      const accountResult = await client.query(
        `SELECT id, role, account_status
         FROM public.users
         WHERE id = $1::bigint
         FOR SHARE`,
        [userId]
      );

      const account = accountResult.rows[0];

      if (
        accountResult.rows.length !== 1 ||
        String(account.id) !== userId ||
        account.role !== "tutor"
      ) {
        throw approvalError("Tutor account not found.", 404);
      }

      if (account.account_status !== "active") {
        throw approvalError(
          "The tutor account must be active.",
          409
        );
      }

      // Lock the profile to prevent simultaneous approval changes.
      const profileResult = await client.query(
        `SELECT id, user_id, approval_status
         FROM public.tutor_profiles
         WHERE id = $1::bigint
           AND user_id = $2::bigint
         FOR UPDATE`,
        [decision.profileId, userId]
      );

      if (profileResult.rows.length !== 1) {
        throw approvalError("Tutor profile not found.", 404);
      }

      const profile = profileResult.rows[0];
      const previousStatus = profile.approval_status;

      if (!approvalStatuses.includes(previousStatus)) {
        throw approvalError(
          "Invalid stored tutor approval status.",
          500
        );
      }

      // Require the administrator to review the latest status.
      if (previousStatus !== decision.expectedStatus) {
        throw approvalError(
          "Tutor approval status has changed. Refresh and try again.",
          409
        );
      }

      if (previousStatus === decision.status) {
        throw approvalError(
          "The tutor already has this approval status.",
          409
        );
      }

      // Prepare the audit record before updating the profile.
      const audit = validateAdminAudit({
        adminId,
        action:
          decision.status === "approved"
            ? "TUTOR_APPROVED"
            : "TUTOR_REJECTED",
        targetType: "tutor_profile",
        targetId: decision.profileId,
        previousValues: {
          approval_status: previousStatus,
        },
        newValues: {
          approval_status: decision.status,
        },
        reason: decision.reason,
        metadata: {
          source: "admin_api",
        },
      });

      // Save the decision without changing other profile information.
      const updated = await client.query(
        `UPDATE public.tutor_profiles
         SET approval_status = $1
         WHERE id = $2::bigint
           AND user_id = $3::bigint
           AND approval_status = $4
         RETURNING id, user_id, approval_status`,
        [
          decision.status,
          decision.profileId,
          userId,
          previousStatus,
        ]
      );

      const row = updated.rows[0];

      if (
        updated.command !== "UPDATE" ||
        updated.rowCount !== 1 ||
        updated.rows.length !== 1 ||
        String(row.id) !== decision.profileId ||
        String(row.user_id) !== userId ||
        row.approval_status !== decision.status
      ) {
        throw approvalError(
          "Tutor approval update could not be verified.",
          500
        );
      }

      // Record the decision in the same database transaction.
      const auditRecord = await recordAdminAudit(
        client,
        audit
      );

      return {
        profileId: decision.profileId,
        userId,
        previousStatus,
        approvalStatus: row.approval_status,
        auditId: auditRecord.id,
        requestId: auditRecord.requestId,
      };
    },
    database
  );
}

module.exports = {
  validateApprovalInput,
  updateTutorApproval,
};
