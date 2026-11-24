"use strict";

const {
  validateAdminTransactionClient,
} = require("./adminTransactionService");

const {
  validateAdminAudit,
  validateAuditId,
} = require("./adminAuditValidationService");

function auditError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = "ADMIN_AUDIT_FAILED";
  return error;
}

// Confirm the administrator is still active before recording the action.
async function verifyAuditAdministrator(client, adminId) {
  const result = await client.query(
    `SELECT id, role, account_status
     FROM public.users
     WHERE id = $1::bigint
       AND role = 'admin'
       AND account_status = 'active'
     FOR SHARE`,
    [adminId]
  );

  if (
    !result ||
    !Array.isArray(result.rows) ||
    result.rows.length !== 1
  ) {
    throw auditError(
      "Active administrator access required.",
      403
    );
  }

  const administrator = result.rows[0];

  if (
    String(administrator.id) !== adminId ||
    administrator.role !== "admin" ||
    administrator.account_status !== "active"
  ) {
    throw auditError(
      "Administrator verification failed.",
      403
    );
  }
}

// Record the action within the caller's administrator transaction.
async function recordAdminAudit(client, input) {
  const audit = validateAdminAudit(input);

  const adminId = validateAdminTransactionClient(
    client,
    audit.adminId
  );

  await verifyAuditAdministrator(client, adminId);

  // Recheck the transaction before writing the audit record.
  validateAdminTransactionClient(client, adminId);

  const result = await client.query(
    `INSERT INTO public.admin_audit_logs (
       admin_id,
       action,
       target_type,
       target_id,
       previous_values,
       new_values,
       reason,
       metadata,
       request_id
     )
     VALUES (
       $1::bigint,
       $2,
       $3,
       $4::bigint,
       $5::jsonb,
       $6::jsonb,
       $7,
       $8::jsonb,
       $9::uuid
     )
     RETURNING
       id,
       admin_id,
       action,
       target_type,
       target_id,
       request_id,
       created_at`,
    [
      adminId,
      audit.action,
      audit.targetType,
      audit.targetId,
      JSON.stringify(audit.previousValues),
      JSON.stringify(audit.newValues),
      audit.reason,
      JSON.stringify(audit.metadata),
      audit.requestId,
    ]
  );

  // Make sure PostgreSQL returned the expected audit record.
  if (
    !result ||
    result.command !== "INSERT" ||
    result.rowCount !== 1 ||
    !Array.isArray(result.rows) ||
    result.rows.length !== 1
  ) {
    throw auditError(
      "Administrator audit record could not be verified."
    );
  }

  const row = result.rows[0];

  if (
    String(row.admin_id) !== adminId ||
    row.action !== audit.action ||
    row.target_type !== audit.targetType ||
    String(row.target_id) !== audit.targetId ||
    row.request_id !== audit.requestId
  ) {
    throw auditError(
      "Administrator audit record verification failed."
    );
  }

  const id = validateAuditId(row.id);

  if (
    !(row.created_at instanceof Date) &&
    typeof row.created_at !== "string"
  ) {
    throw auditError(
      "Invalid administrator audit timestamp."
    );
  }

  const createdAt = new Date(row.created_at);

  if (!Number.isFinite(createdAt.getTime())) {
    throw auditError(
      "Invalid administrator audit timestamp."
    );
  }

  validateAdminTransactionClient(client, adminId);

  // Return only the information needed by the caller.
  return {
    id,
    adminId,
    action: audit.action,
    targetType: audit.targetType,
    targetId: audit.targetId,
    requestId: audit.requestId,
    createdAt: createdAt.toISOString(),
  };
}

module.exports = {
  recordAdminAudit,
};
