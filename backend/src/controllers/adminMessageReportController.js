"use strict";

const {
  AdminReportError,
  getReportStatistics,
  listReports,
  getReportDetails,
  updateReportStatus,
} = require("../services/adminMessageReportService");

const LIST_FILTERS = Object.freeze([
  "page",
  "limit",
  "status",
  "reason",
  "search",
]);

const DECISION_FIELDS = Object.freeze([
  "status",
  "expectedStatus",
  "reason",
]);

function sendError(res, status, message, code) {
  const response = {
    success: false,
    error: message,
  };

  if (code) {
    response.code = code;
  }

  return res.status(status).json(response);
}

function sendReportError(res, error) {
  if (error?.code === "ADMIN_COMMIT_UNCERTAIN") {
    return sendError(
      res,
      503,
      "The operation outcome requires verification. Refresh before trying again.",
      "ADMIN_COMMIT_UNCERTAIN"
    );
  }

  const status = error instanceof AdminReportError
    ? error.status
    : error?.statusCode;

  const messages = {
    400: "Invalid message report request.",
    403: "Active administrator access required.",
    404: "Message report not found.",
    409: "The report decision conflicts with its current status. Refresh and try again.",
  };

  const allowedCodes = [
    "INVALID_REPORT_TRANSITION",
    "REPORT_STATUS_CONFLICT",
    "MESSAGE_REPORT_NOT_FOUND",
    "INVALID_REPORT_DECISION",
  ];

  if (Object.hasOwn(messages, status)) {
    return sendError(
      res,
      status,
      messages[status],
      allowedCodes.includes(error?.code)
        ? error.code
        : undefined
    );
  }

  // Never log confidential messages or database error details.
  console.error("Administrator message report operation failed.");

  return sendError(
    res,
    503,
    "Message report operation temporarily unavailable."
  );
}

function authorize(req, res) {
  res.set("Cache-Control", "no-store");

  if (req.user?.role !== "admin") {
    sendError(
      res,
      403,
      "Administrator access required."
    );

    return false;
  }

  return true;
}

function rejectQuery(req, res) {
  if (Object.keys(req.query).length !== 0) {
    sendError(
      res,
      400,
      "Query parameters are not supported."
    );

    return true;
  }

  return false;
}

function parseListFilters(query) {
  const filters = Object.create(null);

  for (const key of Object.keys(query)) {
    if (
      !LIST_FILTERS.includes(key) ||
      typeof query[key] !== "string"
    ) {
      throw new AdminReportError(
        400,
        "Invalid report filter."
      );
    }

    filters[key] = query[key];
  }

  return filters;
}

function parseDecision(body) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    (
      Object.getPrototypeOf(body) !== Object.prototype &&
      Object.getPrototypeOf(body) !== null
    )
  ) {
    throw new AdminReportError(
      400,
      "Invalid report decision."
    );
  }

  const keys = Reflect.ownKeys(body);
  const data = Object.create(null);

  if (keys.length !== DECISION_FIELDS.length) {
    throw new AdminReportError(
      400,
      "Status, expected status and reason are required."
    );
  }

  for (const key of keys) {
    const descriptor =
      Object.getOwnPropertyDescriptor(body, key);

    if (
      !DECISION_FIELDS.includes(key) ||
      !descriptor.enumerable ||
      !Object.hasOwn(descriptor, "value") ||
      typeof descriptor.value !== "string"
    ) {
      throw new AdminReportError(
        400,
        "Unsupported report decision field."
      );
    }

    data[key] = descriptor.value;
  }

  return data;
}

// Return aggregate message report statistics.
async function getAdminMessageReportStatistics(req, res) {
  if (!authorize(req, res)) return;
  if (rejectQuery(req, res)) return;

  try {
    const statistics = await getReportStatistics(req.user);

    return res.status(200).json({
      success: true,
      statistics,
    });
  } catch (error) {
    return sendReportError(res, error);
  }
}

// Return paginated, non-confidential report summaries.
async function getAdminMessageReports(req, res) {
  if (!authorize(req, res)) return;

  try {
    const filters = parseListFilters(req.query);

    const result = await listReports(
      req.user,
      filters
    );

    return res.status(200).json({
      success: true,
      reports: result.reports,
      pagination: result.pagination,
    });
  } catch (error) {
    return sendReportError(res, error);
  }
}

// Return confidential report details only after audit commit.
async function getAdminMessageReportById(req, res) {
  if (!authorize(req, res)) return;
  if (rejectQuery(req, res)) return;

  try {
    const result = await getReportDetails(
      req.user.userId,
      req.params.id
    );

    return res.status(200).json({
      success: true,
      report: result.report,
      auditId: result.auditId,
      requestId: result.requestId,
    });
  } catch (error) {
    return sendReportError(res, error);
  }
}

// Apply an audited administrator report decision.
async function changeAdminMessageReportStatus(req, res) {
  if (!authorize(req, res)) return;

  if (!req.is("application/json")) {
    return sendError(
      res,
      415,
      "An application/json request is required."
    );
  }

  if (rejectQuery(req, res)) return;

  try {
    const data = parseDecision(req.body);

    const decision = await updateReportStatus({
      adminId: req.user.userId,
      reportId: req.params.id,
      status: data.status,
      expectedStatus: data.expectedStatus,
      reason: data.reason,
    });

    return res.status(200).json({
      success: true,
      decision,
    });
  } catch (error) {
    return sendReportError(res, error);
  }
}

module.exports = {
  getAdminMessageReportStatistics,
  getAdminMessageReports,
  getAdminMessageReportById,
  changeAdminMessageReportStatus,
};
