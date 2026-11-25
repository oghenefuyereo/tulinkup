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

const accountStatuses = [
  "active",
  "suspended",
  "removed",
];

const actions = {
  active: "ACCOUNT_REACTIVATED",
  suspended: "ACCOUNT_SUSPENDED",
  removed: "ACCOUNT_REMOVED",
};

function accountError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// Check whether an account can move to the requested status.
function canChangeAccountStatus(previous, next) {
  return (
    (previous === "active" &&
      ["suspended", "removed"].includes(next)) ||
    (previous === "suspended" &&
      ["active", "removed"].includes(next))
  );
}

// Validate the administrator's request before accessing the database.
function validateAccountStatusInput(input) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    (
      Object.getPrototypeOf(input) !== Object.prototype &&
      Object.getPrototypeOf(input) !== null
    )
  ) {
    throw accountError("Invalid account status request.");
  }

  const allowedFields = [
    "adminId",
    "userId",
    "status",
    "expectedStatus",
    "reason",
  ];

  const keys = Reflect.ownKeys(input);
  const data = Object.create(null);

  if (keys.length !== allowedFields.length) {
    throw accountError("Required account status fields are missing.");
  }

  for (const key of keys) {
    const descriptor =
      Object.getOwnPropertyDescriptor(input, key);

    if (
      !allowedFields.includes(key) ||
      !descriptor.enumerable ||
      !Object.hasOwn(descriptor, "value")
    ) {
      throw accountError("Unsupported account status field.");
    }

    data[key] = descriptor.value;
  }

  const adminId = validateAdminId(data.adminId);
  const userId = validateAuditId(data.userId);

  if (adminId === userId) {
    throw accountError(
      "Administrators cannot change their own account status.",
      403
    );
  }

  if (
    !accountStatuses.includes(data.status) ||
    !accountStatuses.includes(data.expectedStatus)
  ) {
    throw accountError("Invalid account status.");
  }

  if (
    !canChangeAccountStatus(
      data.expectedStatus,
      data.status
    )
  ) {
    throw accountError(
      "This account status transition is not permitted.",
      409
    );
  }

  if (!REASON_CODES.includes(data.reason)) {
    throw accountError(
      "A valid administrative reason is required."
    );
  }

  return {
    adminId,
    userId,
    status: data.status,
    expectedStatus: data.expectedStatus,
    reason: data.reason,
  };
}

// Change the account status and record the decision together.
async function updateAccountStatus(input, database) {
  const decision = validateAccountStatusInput(input);

  return withAdminTransaction(
    decision.adminId,
    async (client, adminId) => {
      // Lock the account before checking its current status.
      const result = await client.query(
        `SELECT id, role, account_status
         FROM public.users
         WHERE id = $1::bigint
           AND role IN ('student', 'tutor')
         FOR UPDATE`,
        [decision.userId]
      );

      if (result.rows.length !== 1) {
        throw accountError(
          "Student or tutor account not found.",
          404
        );
      }

      const account = result.rows[0];

      if (
        String(account.id) !== decision.userId ||
        !["student", "tutor"].includes(account.role)
      ) {
        throw accountError(
          "Account verification failed.",
          500
        );
      }

      const previousStatus = account.account_status;

      if (!accountStatuses.includes(previousStatus)) {
        throw accountError(
          "Invalid stored account status.",
          500
        );
      }

      // Prevent changes based on outdated account information.
      if (
        previousStatus !== decision.expectedStatus ||
        !canChangeAccountStatus(
          previousStatus,
          decision.status
        )
      ) {
        throw accountError(
          "Account status has changed. Refresh and try again.",
          409
        );
      }

      const audit = validateAdminAudit({
        adminId,
        action: actions[decision.status],
        targetType: "user",
        targetId: decision.userId,
        previousValues: {
          account_status: previousStatus,
        },
        newValues: {
          account_status: decision.status,
        },
        reason: decision.reason,
        metadata: {
          source: "admin_api",
        },
      });

      // Preserve the account and its historical records.
      const updated = await client.query(
        `UPDATE public.users
         SET account_status = $1
         WHERE id = $2::bigint
           AND role = $3
           AND account_status = $4
         RETURNING id, role, account_status`,
        [
          decision.status,
          decision.userId,
          account.role,
          previousStatus,
        ]
      );

      const row = updated.rows[0];

      if (
        updated.command !== "UPDATE" ||
        updated.rowCount !== 1 ||
        updated.rows.length !== 1 ||
        String(row.id) !== decision.userId ||
        row.role !== account.role ||
        row.account_status !== decision.status
      ) {
        throw accountError(
          "Account status update could not be verified.",
          500
        );
      }

      const auditRecord = await recordAdminAudit(
        client,
        audit
      );

      return {
        userId: decision.userId,
        role: row.role,
        previousStatus,
        accountStatus: row.account_status,
        auditId: auditRecord.id,
        requestId: auditRecord.requestId,
      };
    },
    database
  );
}

module.exports = {
  canChangeAccountStatus,
  validateAccountStatusInput,
  updateAccountStatus,
};
