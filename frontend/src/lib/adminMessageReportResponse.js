const STATUSES = new Set([
  "pending",
  "reviewing",
  "resolved",
  "dismissed",
]);

const REASONS = new Set([
  "spam",
  "harassment",
  "inappropriate_content",
  "safety_concern",
  "payment_solicitation",
  "other",
]);

const ROLES = new Set([
  "student",
  "tutor",
  "admin",
]);

const TRANSITIONS = new Set([
  "pending:reviewing",
  "reviewing:resolved",
  "reviewing:dismissed",
]);

const SUMMARY_FIELDS = [
  "id",
  "conversation_id",
  "message_id",
  "reason",
  "status",
  "created_at",
  "reviewed_at",
  "reviewed_by",
  "reporter_id",
  "reporter_name",
  "reporter_role",
  "reported_user_id",
  "reported_user_name",
  "reported_user_role",
];

const DETAIL_FIELDS = [
  ...SUMMARY_FIELDS,
  "details",
  "message_body",
  "message_created_at",
];

function requireValid(condition) {
  if (!condition) {
    throw new Error("Invalid administrator message report response.");
  }
}

function exactFields(value, fields) {
  requireValid(
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );

  const keys = Reflect.ownKeys(value);

  requireValid(
    keys.length === fields.length &&
    keys.every(key => fields.includes(key))
  );

  for (const key of fields) {
    const descriptor =
      Object.getOwnPropertyDescriptor(value, key);

    requireValid(
      descriptor &&
      descriptor.enumerable &&
      Object.hasOwn(descriptor, "value")
    );
  }

  return value;
}

function validId(value) {
  return (
    typeof value === "string" &&
    /^[1-9][0-9]{0,18}$/.test(value) &&
    BigInt(value) <= 9223372036854775807n
  );
}

function validCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validTimestamp(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function validRequestId(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)
  );
}

function validText(value, max, allowEmpty = false) {
  return (
    typeof value === "string" &&
    !value.includes("\u0000") &&
    Array.from(value).length <= max &&
    (allowEmpty || value.trim().length > 0)
  );
}

function validateReport(report, confidential = false) {
  exactFields(
    report,
    confidential ? DETAIL_FIELDS : SUMMARY_FIELDS
  );

  for (const field of [
    "id",
    "conversation_id",
    "message_id",
    "reporter_id",
    "reported_user_id",
  ]) {
    requireValid(validId(report[field]));
  }

  requireValid(
    report.reporter_id !== report.reported_user_id &&
    STATUSES.has(report.status) &&
    REASONS.has(report.reason) &&
    ROLES.has(report.reporter_role) &&
    ROLES.has(report.reported_user_role) &&
    validText(report.reporter_name, 1000) &&
    validText(report.reported_user_name, 1000) &&
    validTimestamp(report.created_at)
  );

  requireValid(
    report.reviewed_at === null ||
    validTimestamp(report.reviewed_at)
  );

  requireValid(
    report.reviewed_by === null ||
    validId(report.reviewed_by)
  );

  if (report.reviewed_at !== null) {
    requireValid(
      Date.parse(report.reviewed_at) >=
      Date.parse(report.created_at)
    );
  }

  if (confidential) {
    requireValid(
      validText(report.message_body, 4000) &&
      validTimestamp(report.message_created_at) &&
      (
        report.details === null ||
        validText(report.details, 2000, true)
      )
    );

    requireValid(
      Date.parse(report.message_created_at) <=
      Date.parse(report.created_at)
    );
  }

  return report;
}

export function validateReportStatisticsResponse(data) {
  exactFields(data, ["success", "statistics"]);

  requireValid(data.success === true);

  const fields = [
    "total",
    "pending",
    "reviewing",
    "resolved",
    "dismissed",
    "openSafetyConcerns",
  ];

  const stats = exactFields(data.statistics, fields);

  requireValid(
    fields.every(field => validCount(stats[field]))
  );

  requireValid(
    stats.total ===
      stats.pending +
      stats.reviewing +
      stats.resolved +
      stats.dismissed
  );

  requireValid(
    stats.openSafetyConcerns <=
      stats.pending + stats.reviewing
  );

  return data;
}

export function validateReportListResponse(data, query) {
  exactFields(data, [
    "success",
    "reports",
    "pagination",
  ]);

  requireValid(
    data.success === true &&
    Array.isArray(data.reports)
  );

  const pagination = exactFields(data.pagination, [
    "page",
    "limit",
    "total",
    "totalPages",
    "hasNextPage",
    "hasPreviousPage",
  ]);

  const page = Number(query.get("page") ?? "1");
  const limit = Number(query.get("limit") ?? "20");

  requireValid(
    Number.isSafeInteger(page) &&
    page >= 1 &&
    page <= 100000 &&
    Number.isSafeInteger(limit) &&
    limit >= 1 &&
    limit <= 100 &&
    pagination.page === page &&
    pagination.limit === limit &&
    validCount(pagination.total) &&
    validCount(pagination.totalPages)
  );

  const totalPages = Math.ceil(
    pagination.total / limit
  );

  requireValid(
    pagination.totalPages === totalPages &&
    pagination.hasNextPage === (page < totalPages) &&
    pagination.hasPreviousPage === (
      page > 1 && totalPages > 0
    )
  );

  const expectedRecords = Math.min(
    limit,
    Math.max(
      0,
      pagination.total - (page - 1) * limit
    )
  );

  requireValid(
    data.reports.length === expectedRecords
  );

  const ids = new Set();
  const status = query.get("status");
  const reason = query.get("reason");

  for (const report of data.reports) {
    validateReport(report);

    requireValid(!ids.has(report.id));

    ids.add(report.id);

    if (status) {
      requireValid(report.status === status);
    }

    if (reason) {
      requireValid(report.reason === reason);
    }
  }

  return data;
}

export function validateReportDetailsResponse(data, id) {
  exactFields(data, [
    "success",
    "report",
    "auditId",
    "requestId",
  ]);

  requireValid(
    data.success === true &&
    validId(id) &&
    validId(data.auditId) &&
    validRequestId(data.requestId)
  );

  validateReport(data.report, true);

  requireValid(data.report.id === id);

  return data;
}

export function validateReportDecisionResponse(
  data,
  id,
  body
) {
  exactFields(data, ["success", "decision"]);

  requireValid(data.success === true);

  const decision = exactFields(data.decision, [
    "reportId",
    "previousStatus",
    "status",
    "reviewedAt",
    "reviewedBy",
    "auditId",
    "requestId",
  ]);

  requireValid(
    validId(id) &&
    decision.reportId === id &&
    decision.previousStatus === body.expectedStatus &&
    decision.status === body.status &&
    TRANSITIONS.has(
      decision.previousStatus + ":" + decision.status
    ) &&
    validTimestamp(decision.reviewedAt) &&
    validId(decision.reviewedBy) &&
    validId(decision.auditId) &&
    validRequestId(decision.requestId)
  );

  return data;
}

export function validateMessageReportResponse(
  data,
  operation,
  { query, id, body } = {}
) {
  switch (operation) {
    case "statistics":
      return validateReportStatisticsResponse(data);

    case "list":
      return validateReportListResponse(data, query);

    case "details":
      return validateReportDetailsResponse(data, id);

    case "decision":
      return validateReportDecisionResponse(
        data,
        id,
        body
      );

    default:
      throw new Error("Unsupported report response.");
  }
}
