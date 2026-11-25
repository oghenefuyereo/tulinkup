"use strict";

const pool = require("../config/db");

const {
  parseDatabaseCount,
} = require("./adminStatisticsValidation");

const REPORT_STATUSES = new Set([
  "pending",
  "reviewing",
  "resolved",
  "dismissed",
]);

const REPORT_REASONS = new Set([
  "spam",
  "harassment",
  "inappropriate_content",
  "safety_concern",
  "payment_solicitation",
  "other",
]);

class AdminReportError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "AdminReportError";
    this.status = status;
  }
}

function requireAdministrator(user) {
  if (!user || user.role !== "admin") {
    throw new AdminReportError(
      403,
      "Administrator access required."
    );
  }

  return validateId(user.userId, "administrator ID");
}

function validateId(value, label) {
  if (
    typeof value !== "string" &&
    !Number.isSafeInteger(value)
  ) {
    throw new AdminReportError(400, `Invalid ${label}.`);
  }

  const id = String(value);

  if (
    !/^[1-9][0-9]{0,18}$/.test(id) ||
    BigInt(id) > 9223372036854775807n
  ) {
    throw new AdminReportError(400, `Invalid ${label}.`);
  }

  return id;
}

function validateInteger(value, fallback, max, label) {
  if (value === undefined) return fallback;

  if (
    typeof value !== "string" &&
    !Number.isSafeInteger(value)
  ) {
    throw new AdminReportError(400, `Invalid ${label}.`);
  }

  if (!/^[1-9][0-9]*$/.test(String(value))) {
    throw new AdminReportError(400, `Invalid ${label}.`);
  }

  const number = Number(value);

  if (!Number.isSafeInteger(number) || number > max) {
    throw new AdminReportError(400, `Invalid ${label}.`);
  }

  return number;
}

function validateFilter(value, allowed, label) {
  if (value === undefined || value === "") return null;

  if (typeof value !== "string" || !allowed.has(value)) {
    throw new AdminReportError(400, `Invalid ${label}.`);
  }

  return value;
}

async function getReportStatistics(user) {
  requireAdministrator(user);

  const result = await pool.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (
        WHERE status = 'pending'
      ) AS pending,
      COUNT(*) FILTER (
        WHERE status = 'reviewing'
      ) AS reviewing,
      COUNT(*) FILTER (
        WHERE status = 'resolved'
      ) AS resolved,
      COUNT(*) FILTER (
        WHERE status = 'dismissed'
      ) AS dismissed,
      COUNT(*) FILTER (
        WHERE reason = 'safety_concern'
        AND status IN ('pending', 'reviewing')
      ) AS open_safety_concerns
    FROM public.message_reports
  `);

  const row = result.rows[0];

  return {
    total: parseDatabaseCount(row.total),
    pending: parseDatabaseCount(row.pending),
    reviewing: parseDatabaseCount(row.reviewing),
    resolved: parseDatabaseCount(row.resolved),
    dismissed: parseDatabaseCount(row.dismissed),
    openSafetyConcerns: parseDatabaseCount(
      row.open_safety_concerns
    ),
  };
}

async function listReports(user, options = {}) {
  requireAdministrator(user);

  const page = validateInteger(
    options.page, 1, 100000, "page"
  );

  const limit = validateInteger(
    options.limit, 20, 100, "limit"
  );

  const status = validateFilter(
    options.status, REPORT_STATUSES, "status"
  );

  const reason = validateFilter(
    options.reason, REPORT_REASONS, "reason"
  );

  const rawSearch = options.search ?? "";

  if (
    typeof rawSearch !== "string" ||
    rawSearch.includes("\u0000") ||
    Array.from(rawSearch).length > 100
  ) {
    throw new AdminReportError(400, "Invalid search.");
  }

  const search = rawSearch.trim();

  const values = [];
  const conditions = [];

  function parameter(value) {
    values.push(value);
    return `$${values.length}`;
  }

  if (status) {
    conditions.push(`r.status = ${parameter(status)}`);
  }

  if (reason) {
    conditions.push(`r.reason = ${parameter(reason)}`);
  }

  if (search) {
    const term = parameter(search);

    conditions.push(`(
      r.id::text = ${term}
      OR strpos(
        lower(reporter.full_name), lower(${term})
      ) > 0
      OR strpos(
        lower(reported.full_name), lower(${term})
      ) > 0
      OR strpos(
        lower(reporter.email), lower(${term})
      ) > 0
      OR strpos(
        lower(reported.email), lower(${term})
      ) > 0
    )`);
  }

  const from = `
    FROM public.message_reports r
    JOIN public.messages m
      ON m.conversation_id = r.conversation_id
      AND m.id = r.message_id
    JOIN public.users reporter
      ON reporter.id = r.reporter_id
    JOIN public.users reported
      ON reported.id = m.sender_id
  `;

  const where = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const offset = (page - 1) * limit;

  const result = await pool.query(`
    WITH filtered AS (
      SELECT
        r.id,
        r.conversation_id,
        r.message_id,
        r.reason,
        r.status,
        r.created_at,
        r.reviewed_at,
        r.reviewed_by,
        reporter.id AS reporter_id,
        reporter.full_name AS reporter_name,
        reporter.role AS reporter_role,
        reported.id AS reported_user_id,
        reported.full_name AS reported_user_name,
        reported.role AS reported_user_role
      ${from}
      ${where}
    ),
    paginated AS (
      SELECT *
      FROM filtered
      ORDER BY
        CASE
          WHEN reason = 'safety_concern'
            AND status IN ('pending', 'reviewing')
          THEN 0
          ELSE 1
        END,
        created_at DESC,
        id DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    )
    SELECT
      (SELECT COUNT(*) FROM filtered) AS total,
      COALESCE(
        (
          SELECT jsonb_agg(
            to_jsonb(p) || jsonb_build_object(
              'id', p.id::text,
              'conversation_id', p.conversation_id::text,
              'message_id', p.message_id::text,
              'reporter_id', p.reporter_id::text,
              'reported_user_id', p.reported_user_id::text,
              'reviewed_by', p.reviewed_by::text
            )
            ORDER BY
              CASE
                WHEN p.reason = 'safety_concern'
                  AND p.status IN ('pending', 'reviewing')
                THEN 0
                ELSE 1
              END,
              p.created_at DESC,
              p.id DESC
          )
          FROM paginated p
        ),
        '[]'::jsonb
      ) AS reports
  `, [...values, limit, offset]);

  const total = parseDatabaseCount(
    result.rows[0].total
  );

  const totalPages = Math.ceil(total / limit);

  return {
    reports: result.rows[0].reports,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1 && totalPages > 0,
    },
  };
}


// Retrieve confidential details for one reported message.
// Never return confidential content before the audit commits.
async function getReportDetails(
  adminId,
  reportId,
  database
) {
  const {
    withAdminTransaction,
  } = require("./adminTransactionService");

  const {
    validateAuditId,
  } = require("./adminAuditValidationService");

  const {
    recordAdminAudit,
  } = require("./adminAuditService");

  const id = validateAuditId(reportId);

  return withAdminTransaction(
    adminId,
    async (client, verifiedAdminId) => {
      const result = await client.query(
        `SELECT
           r.id::text AS id,
           r.conversation_id::text AS conversation_id,
           r.message_id::text AS message_id,
           r.reason,
           r.details,
           r.status,
           r.created_at,
           r.reviewed_at,
           r.reviewed_by::text AS reviewed_by,
           m.body AS message_body,
           m.created_at AS message_created_at,
           reporter.id::text AS reporter_id,
           reporter.full_name AS reporter_name,
           reporter.role AS reporter_role,
           reported.id::text AS reported_user_id,
           reported.full_name AS reported_user_name,
           reported.role AS reported_user_role
         FROM public.message_reports r
         JOIN public.messages m
           ON m.id = r.message_id
           AND m.conversation_id = r.conversation_id
         JOIN public.users reporter
           ON reporter.id = r.reporter_id
         JOIN public.users reported
           ON reported.id = m.sender_id
         WHERE r.id = $1::bigint
         FOR SHARE OF r`,
        [id]
      );

      if (result.rows.length === 0) {
        const error = new Error(
          "Message report not found."
        );
        error.statusCode = 404;
        error.code = "MESSAGE_REPORT_NOT_FOUND";
        throw error;
      }

      if (
        result.command !== "SELECT" ||
        result.rowCount !== 1 ||
        result.rows.length !== 1
      ) {
        throw new Error(
          "Message report retrieval could not be verified."
        );
      }

      const report = result.rows[0];

      if (
        report.id !== id ||
        ![
          "pending",
          "reviewing",
          "resolved",
          "dismissed",
        ].includes(report.status) ||
        typeof report.message_body !== "string" ||
        report.message_body.trim().length === 0 ||
        Array.from(report.message_body).length > 4000 ||
        (
          report.details !== null &&
          (
            typeof report.details !== "string" ||
            Array.from(report.details).length > 2000
          )
        )
      ) {
        throw new Error(
          "Invalid stored message report."
        );
      }

      // Record access without including private content.
      const audit = await recordAdminAudit(client, {
        adminId: verifiedAdminId,
        action: "MESSAGE_REPORT_VIEWED",
        targetType: "message_report",
        targetId: id,
        previousValues: {
          status: report.status,
        },
        newValues: {
          status: report.status,
        },
        reason: "ADMINISTRATIVE_REVIEW",
        metadata: {
          source: "admin_api",
        },
      });

      // The transaction service returns this only
      // after PostgreSQL confirms the commit.
      return {
        report: {
          id: report.id,
          conversation_id: report.conversation_id,
          message_id: report.message_id,
          reason: report.reason,
          details: report.details,
          status: report.status,
          created_at: report.created_at,
          reviewed_at: report.reviewed_at,
          reviewed_by: report.reviewed_by,
          message_body: report.message_body,
          message_created_at: report.message_created_at,
          reporter_id: report.reporter_id,
          reporter_name: report.reporter_name,
          reporter_role: report.reporter_role,
          reported_user_id: report.reported_user_id,
          reported_user_name: report.reported_user_name,
          reported_user_role: report.reported_user_role,
        },
        auditId: audit.id,
        requestId: audit.requestId,
      };
    },
    database
  );
}


// Validate and apply an audited message report decision.
async function updateReportStatus(input, database) {
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

  function statusError(message, statusCode, code) {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    return error;
  }

  function invalidInput() {
    return statusError(
      "Invalid message report decision.",
      400,
      "INVALID_REPORT_DECISION"
    );
  }

  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    throw invalidInput();
  }

  const prototype = Object.getPrototypeOf(input);

  if (
    prototype !== Object.prototype &&
    prototype !== null
  ) {
    throw invalidInput();
  }

  const allowedFields = [
    "adminId",
    "reportId",
    "status",
    "expectedStatus",
    "reason",
  ];

  const data = Object.create(null);

  for (const key of Reflect.ownKeys(input)) {
    const descriptor =
      Object.getOwnPropertyDescriptor(input, key);

    if (
      !allowedFields.includes(key) ||
      !descriptor.enumerable ||
      !Object.hasOwn(descriptor, "value")
    ) {
      throw invalidInput();
    }

    data[key] = descriptor.value;
  }

  const adminId = validateAdminId(data.adminId);
  const reportId = validateAuditId(data.reportId);

  const statuses = [
    "pending",
    "reviewing",
    "resolved",
    "dismissed",
  ];

  if (
    !statuses.includes(data.expectedStatus) ||
    !statuses.includes(data.status) ||
    !REASON_CODES.includes(data.reason)
  ) {
    throw invalidInput();
  }

  const transitions = {
    "pending:reviewing":
      "MESSAGE_REPORT_REVIEW_STARTED",
    "reviewing:resolved":
      "MESSAGE_REPORT_RESOLVED",
    "reviewing:dismissed":
      "MESSAGE_REPORT_DISMISSED",
  };

  const action = transitions[
    `${data.expectedStatus}:${data.status}`
  ];

  if (!action) {
    throw statusError(
      "This report status transition is not permitted.",
      409,
      "INVALID_REPORT_TRANSITION"
    );
  }

  return withAdminTransaction(
    adminId,
    async (client, verifiedAdminId) => {
      // Prevent concurrent decisions on the same report.
      const existing = await client.query(
        `SELECT id::text AS id, status
         FROM public.message_reports
         WHERE id = $1::bigint
         FOR UPDATE`,
        [reportId]
      );

      if (existing.rows.length === 0) {
        throw statusError(
          "Message report not found.",
          404,
          "MESSAGE_REPORT_NOT_FOUND"
        );
      }

      if (
        existing.command !== "SELECT" ||
        existing.rowCount !== 1 ||
        existing.rows.length !== 1 ||
        existing.rows[0].id !== reportId ||
        !statuses.includes(existing.rows[0].status)
      ) {
        throw statusError(
          "Stored report could not be verified.",
          500,
          "REPORT_VERIFICATION_FAILED"
        );
      }

      const previousStatus =
        existing.rows[0].status;

      // Reject stale administrator decisions.
      if (previousStatus !== data.expectedStatus) {
        throw statusError(
          "Report status has changed. Refresh and try again.",
          409,
          "REPORT_STATUS_CONFLICT"
        );
      }

      // Validate the audit before modifying the report.
      const audit = validateAdminAudit({
        adminId: verifiedAdminId,
        action,
        targetType: "message_report",
        targetId: reportId,
        previousValues: {
          status: previousStatus,
        },
        newValues: {
          status: data.status,
        },
        reason: data.reason,
        metadata: {
          source: "admin_api",
        },
      });

      const updated = await client.query(
        `UPDATE public.message_reports
         SET status = $1,
             reviewed_at = clock_timestamp(),
             reviewed_by = $2::bigint
         WHERE id = $3::bigint
           AND status = $4
         RETURNING
           id::text AS id,
           status,
           reviewed_at,
           reviewed_by::text AS reviewed_by`,
        [
          data.status,
          verifiedAdminId,
          reportId,
          previousStatus,
        ]
      );

      const row = updated.rows[0];

      if (
        updated.command !== "UPDATE" ||
        updated.rowCount !== 1 ||
        updated.rows.length !== 1 ||
        !row ||
        row.id !== reportId ||
        row.status !== data.status ||
        row.reviewed_by !== verifiedAdminId ||
        !(row.reviewed_at instanceof Date) ||
        !Number.isFinite(row.reviewed_at.getTime())
      ) {
        throw statusError(
          "Report update could not be verified.",
          500,
          "REPORT_UPDATE_FAILED"
        );
      }

      // Both the status change and audit must commit.
      const auditRecord = await recordAdminAudit(
        client,
        audit
      );

      return {
        reportId,
        previousStatus,
        status: row.status,
        reviewedAt: row.reviewed_at,
        reviewedBy: row.reviewed_by,
        auditId: auditRecord.id,
        requestId: auditRecord.requestId,
      };
    },
    database
  );
}

module.exports = {
  updateReportStatus,
  getReportDetails,
  AdminReportError,
  REPORT_STATUSES,
  REPORT_REASONS,
  requireAdministrator,
  validateId,
  getReportStatistics,
  listReports,
};
