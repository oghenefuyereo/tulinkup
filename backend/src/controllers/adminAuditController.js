"use strict";

const pool = require("../config/db");

const {
  parseDatabaseCount,
} = require("../services/adminStatisticsValidation");

const {
  ACTION_TARGETS,
  validateAuditId,
  validateAdminAudit,
} = require("../services/adminAuditValidationService");

const ALLOWED_FILTERS = Object.freeze([
  "adminId",
  "action",
  "targetType",
  "targetId",
  "startDate",
  "endDate",
  "page",
  "limit",
]);

const TARGET_TYPES = Object.freeze([
  ...new Set(Object.values(ACTION_TARGETS)),
]);

function invalidFilter(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function parsePositiveInteger(value, fallback, maximum) {
  if (value === undefined) {
    return fallback;
  }

  if (
    typeof value !== "string" ||
    !/^[1-9]\d*$/.test(value) ||
    value.length > 10
  ) {
    throw invalidFilter("Invalid pagination value.");
  }

  const number = Number(value);

  if (
    !Number.isSafeInteger(number) ||
    number > maximum
  ) {
    throw invalidFilter("Pagination value is out of range.");
  }

  return number;
}

function parseDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith("0000")
  ) {
    throw invalidFilter("Dates must use YYYY-MM-DD format.");
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw invalidFilter("Invalid calendar date.");
  }

  return value;
}

function parseAuditFilters(query) {
  for (const key of Object.keys(query)) {
    if (!ALLOWED_FILTERS.includes(key)) {
      throw invalidFilter("Unsupported audit filter.");
    }

    if (typeof query[key] !== "string") {
      throw invalidFilter("Invalid audit filter value.");
    }
  }

  const filters = {
    page: parsePositiveInteger(query.page, 1, 10000),
    limit: parsePositiveInteger(query.limit, 20, 100),
  };

  if (query.adminId !== undefined) {
    filters.adminId = validateAuditId(query.adminId);
  }

  if (query.targetId !== undefined) {
    filters.targetId = validateAuditId(query.targetId);
  }

  if (query.action !== undefined) {
    if (!Object.hasOwn(ACTION_TARGETS, query.action)) {
      throw invalidFilter("Unsupported administrator action.");
    }

    filters.action = query.action;
  }

  if (query.targetType !== undefined) {
    if (!TARGET_TYPES.includes(query.targetType)) {
      throw invalidFilter("Unsupported audit target type.");
    }

    filters.targetType = query.targetType;
  }

  if (
    filters.action &&
    filters.targetType &&
    ACTION_TARGETS[filters.action] !== filters.targetType
  ) {
    throw invalidFilter("Audit action and target type do not match.");
  }

  if (query.startDate !== undefined) {
    filters.startDate = parseDate(query.startDate);
  }

  if (query.endDate !== undefined) {
    filters.endDate = parseDate(query.endDate);
  }

  if (
    filters.startDate &&
    filters.endDate &&
    filters.startDate > filters.endDate
  ) {
    throw invalidFilter("Start date cannot follow end date.");
  }

  return filters;
}

function buildAuditWhere(filters) {
  const conditions = [];
  const values = [];

  // Keep user input separate from the SQL statement.
  function add(value, condition) {
    values.push(value);
    conditions.push(condition(`$${values.length}`));
  }

  if (filters.adminId) {
    add(filters.adminId, p => `a.admin_id = ${p}::bigint`);
  }

  if (filters.action) {
    add(filters.action, p => `a.action = ${p}`);
  }

  if (filters.targetType) {
    add(filters.targetType, p => `a.target_type = ${p}`);
  }

  if (filters.targetId) {
    add(filters.targetId, p => `a.target_id = ${p}::bigint`);
  }

  if (filters.startDate) {
    add(
      filters.startDate,
      p => `a.created_at >= (${p}::date::timestamp AT TIME ZONE 'UTC')`
    );
  }

  if (filters.endDate) {
    add(
      filters.endDate,
      p => `a.created_at < ((${p}::date + 1)::timestamp AT TIME ZONE 'UTC')`
    );
  }

  return {
    where: conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "",
    values,
  };
}

function serializeAuditRecord(row) {
  // Validate stored records before exposing their contents.
  const audit = validateAdminAudit({
    adminId: row.admin_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    previousValues: row.previous_values,
    newValues: row.new_values,
    reason: row.reason,
    metadata: row.metadata,
    requestId: row.request_id,
  });

  const createdAt = new Date(row.created_at);

  if (
    row.created_at === null ||
    !Number.isFinite(createdAt.getTime())
  ) {
    throw new Error("Invalid stored audit timestamp.");
  }

  return {
    id: validateAuditId(row.id),
    adminId: audit.adminId,
    action: audit.action,
    targetType: audit.targetType,
    targetId: audit.targetId,
    previousValues: audit.previousValues,
    newValues: audit.newValues,
    reason: audit.reason,
    metadata: audit.metadata,
    requestId: audit.requestId,
    createdAt: createdAt.toISOString(),
  };
}

async function getAdminAuditLogs(req, res) {
  res.set("Cache-Control", "no-store");

  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Administrator access required.",
    });
  }

  let filters;

  try {
    filters = parseAuditFilters(req.query);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.statusCode === 400
        ? error.message
        : "Invalid audit filters.",
    });
  }

  let client;
  let transactionStarted = false;
  let discard = false;
  let connectionFailed = false;
  let commitStarted = false;

  // Keep track of database connection failures.
  function handleConnectionError() {
    connectionFailed = true;
    discard = true;
  }

  try {
    client = await pool.connect();

    client.on("error", handleConnectionError);

    // Discard the connection if transaction startup fails.
    discard = true;

    const begin = await client.query(
      "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"
    );

    if (
      connectionFailed ||
      begin?.command !== "BEGIN"
    ) {
      throw new Error("Audit transaction could not be started.");
    }

    transactionStarted = true;
    discard = false;

    // Prevent database operations from waiting indefinitely.
    await client.query(
      "SET LOCAL lock_timeout = '5s'"
    );

    await client.query(
      "SET LOCAL statement_timeout = '15s'"
    );

    await client.query(
      "SET LOCAL idle_in_transaction_session_timeout = '30s'"
    );

    // Confirm the administrator is still active.
    const administrator = await client.query(
      `SELECT id
       FROM public.users
       WHERE id = $1::bigint
         AND role = 'admin'
         AND account_status = 'active'`,
      [validateAuditId(req.user.userId)]
    );

    if (administrator.rowCount !== 1) {
      const rollback = await client.query("ROLLBACK");

      if (
        connectionFailed ||
        rollback?.command !== "ROLLBACK"
      ) {
        discard = true;
        throw new Error("Audit rollback failed.");
      }

      transactionStarted = false;

      return res.status(403).json({
        success: false,
        message: "Active administrator access required.",
      });
    }

    const { where, values } = buildAuditWhere(filters);

    const countResult = await client.query(
      `SELECT COUNT(*) AS total
       FROM public.admin_audit_logs a
       ${where}`,
      values
    );

    const total = parseDatabaseCount(
      countResult.rows[0].total
    );

    const offset = (filters.page - 1) * filters.limit;

    const limitPosition = values.length + 1;
    const offsetPosition = values.length + 2;

    // Read the count and records from the same database snapshot.
    const result = await client.query(
      `SELECT
         a.id,
         a.admin_id,
         a.action,
         a.target_type,
         a.target_id,
         a.previous_values,
         a.new_values,
         a.reason,
         a.metadata,
         a.request_id,
         a.created_at
       FROM public.admin_audit_logs a
       ${where}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT $${limitPosition}::integer
       OFFSET $${offsetPosition}::integer`,
      [...values, filters.limit, offset]
    );

    const auditLogs = result.rows.map(serializeAuditRecord);

    // Verify that the records match the requested page.
    const expectedRecords = Math.min(
      filters.limit,
      Math.max(0, total - offset)
    );

    if (auditLogs.length !== expectedRecords) {
      throw new Error("Invalid audit pagination result.");
    }

    if (connectionFailed) {
      throw new Error("Audit database connection failed.");
    }

    commitStarted = true;

    const commit = await client.query("COMMIT");

    if (
      connectionFailed ||
      commit?.command !== "COMMIT"
    ) {
      discard = true;
      throw new Error("Audit read transaction failed.");
    }

    transactionStarted = false;
    commitStarted = false;

    return res.status(200).json({
      success: true,
      auditLogs,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
        hasNextPage: filters.page * filters.limit < total,
        hasPreviousPage: filters.page > 1,
      },
    });
  } catch (error) {
    if (client) {
      if (connectionFailed || commitStarted || discard) {
        discard = true;
      } else if (transactionStarted) {
        try {
          const rollback = await client.query("ROLLBACK");

          if (
            connectionFailed ||
            rollback?.command !== "ROLLBACK"
          ) {
            discard = true;
          }
        } catch {
          discard = true;
        }
      }
    }

    // Do not expose database errors or audit contents.
    console.error("Administrator audit retrieval failed.");

    return res.status(503).json({
      success: false,
      message: "Unable to retrieve administrator audit logs.",
    });
  } finally {
    if (client) {
      client.release(discard);

      // Keep discarded connections protected during shutdown.
      if (!discard) {
        client.removeListener(
          "error",
          handleConnectionError
        );
      }
    }
  }
}

module.exports = {
  getAdminAuditLogs,
  parseAuditFilters,
  buildAuditWhere,
  serializeAuditRecord,
};
