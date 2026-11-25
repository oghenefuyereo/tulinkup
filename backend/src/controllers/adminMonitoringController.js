"use strict";

const pool = require("../config/db");

const {
  parseDatabaseCount,
} = require("../services/adminStatisticsValidation");

const bookingStatuses = [
  "pending",
  "accepted",
  "declined",
  "cancelled",
  "completed",
];

const classStatuses = [
  "draft",
  "published",
  "live",
  "completed",
  "cancelled",
];

const paymentStatuses = [
  "unpaid",
  "pending",
  "paid",
  "failed",
  "refunded",
  "not_required",
];

const sessionStatuses = [
  "scheduled",
  "live",
  "completed",
  "cancelled",
  "no_session",
];

function fail(res, status, error) {
  return res.status(status).json({
    success: false,
    error,
  });
}

// Validate pagination before querying the database.
function positiveInteger(value, fallback, maximum) {
  if (value === undefined) return fallback;

  if (
    typeof value !== "string" ||
    !/^[1-9]\d*$/.test(value)
  ) {
    throw new Error("Invalid pagination.");
  }

  const number = Number(value);

  if (!Number.isSafeInteger(number) || number > maximum) {
    throw new Error("Invalid pagination.");
  }

  return number;
}

// Escape search characters so they are treated as literal text.
function escapeSearch(value) {
  return value.replace(/[!%_]/g, character => "!" + character);
}

// Validate the filters supported by each monitoring endpoint.
function getFilters(query, mode) {
  const allowed = [
    "page",
    "limit",
    "search",
    "status",
    "sessionStatus",
  ];

  if (mode === "bookings") {
    allowed.push("paymentStatus");
  }

  for (const key of Object.keys(query)) {
    if (!allowed.includes(key) || typeof query[key] !== "string") {
      throw new Error("Invalid monitoring filter.");
    }
  }

  const page = positiveInteger(query.page, 1, 10000);
  const limit = positiveInteger(query.limit, 20, 100);

  const search = (query.search || "").trim();

  if (
    search.length > 100 ||
    /[\x00-\x1f\x7f]/.test(query.search || "")
  ) {
    throw new Error("Invalid search.");
  }

  const statuses = mode === "bookings"
    ? bookingStatuses
    : classStatuses;

  if (
    query.status !== undefined &&
    !statuses.includes(query.status)
  ) {
    throw new Error("Invalid status.");
  }

  if (
    query.paymentStatus !== undefined &&
    !paymentStatuses.includes(query.paymentStatus)
  ) {
    throw new Error("Invalid payment status.");
  }

  if (
    query.sessionStatus !== undefined &&
    !sessionStatuses.includes(query.sessionStatus)
  ) {
    throw new Error("Invalid session status.");
  }

  return {
    page,
    limit,
    search,
    status: query.status,
    paymentStatus: query.paymentStatus,
    sessionStatus: query.sessionStatus,
  };
}

// Build parameterized filters without accepting SQL from requests.
function buildConditions(filters, mode) {
  const values = [];
  const conditions = [];

  const alias = mode === "bookings" ? "b" : "gc";

  function parameter(value) {
    values.push(value);
    return "$" + values.length;
  }

  if (filters.status) {
    conditions.push(
      alias + ".status = " + parameter(filters.status)
    );
  }

  if (filters.paymentStatus) {
    conditions.push(
      "b.payment_status = " + parameter(filters.paymentStatus)
    );
  }

  if (filters.sessionStatus === "no_session") {
    conditions.push("ls.id IS NULL");
  } else if (filters.sessionStatus) {
    conditions.push(
      "ls.status = " + parameter(filters.sessionStatus)
    );
  }

  if (filters.search) {
    const term = parameter(
      "%" + escapeSearch(filters.search) + "%"
    );

    const columns = mode === "bookings"
      ? [
          "b.id::text",
          "b.subject_name",
          "s.full_name",
          "t.full_name",
        ]
      : [
          "gc.id::text",
          "gc.title",
          "gc.subject",
          "t.full_name",
        ];

    conditions.push(
      "(" + columns.map(column =>
        column + " ILIKE " + term + " ESCAPE '!'"
      ).join(" OR ") + ")"
    );
  }

  return {
    values,
    where: conditions.length
      ? "WHERE " + conditions.join(" AND ")
      : "",
  };
}

// Return only the information needed for booking monitoring.
const bookingSelect = [
  'b.id::text AS "id"',
  'b.student_id::text AS "studentId"',
  'b.tutor_id::text AS "tutorId"',
  's.full_name AS "studentName"',
  't.full_name AS "tutorName"',
  'b.subject_name AS "subject"',
  'b.booking_date::text AS "date"',
  'b.booking_time::text AS "startTime"',
  'b.duration_minutes AS "durationMinutes"',
  'b.status AS "status"',
  'b.total_price_cents AS "totalPriceCents"',
  'b.currency AS "currency"',
  'b.payment_status AS "paymentStatus"',
  'ls.status AS "sessionStatus"',
  'b.created_at AS "createdAt"',
].join(", ");

const bookingFrom = [
  "FROM public.bookings b",
  "JOIN public.users s ON s.id = b.student_id",
  "JOIN public.users t ON t.id = b.tutor_id",
  "LEFT JOIN public.live_sessions ls ON ls.booking_id = b.id",
].join(" ");

// Include class capacity and enrollment activity without student details.
const classSelect = [
  'gc.id::text AS "id"',
  'gc.tutor_id::text AS "tutorId"',
  't.full_name AS "tutorName"',
  'gc.title AS "title"',
  'gc.subject AS "subject"',
  'gc.education_level AS "educationLevel"',
  'gc.scheduled_at AS "scheduledAt"',
  'gc.duration_minutes AS "durationMinutes"',
  'gc.price_cents AS "priceCents"',
  'gc.currency AS "currency"',
  'gc.minimum_students AS "minimumStudents"',
  'gc.maximum_students AS "maximumStudents"',
  'gc.status AS "status"',
  'ls.status AS "sessionStatus"',
  'gc.created_at AS "createdAt"',
  '(SELECT COUNT(*)::integer FROM public.group_class_enrollments e WHERE e.class_id = gc.id) AS "totalEnrollments"',
  "(SELECT COUNT(*)::integer FROM public.group_class_enrollments e WHERE e.class_id = gc.id AND e.enrollment_status IN ('pending', 'confirmed', 'attended', 'absent')) AS \"enrolledStudents\"",
  "(SELECT COUNT(*)::integer FROM public.group_class_enrollments e WHERE e.class_id = gc.id AND e.enrollment_status = 'confirmed') AS \"confirmedStudents\"",
].join(", ");

const classFrom = [
  "FROM public.group_classes gc",
  "JOIN public.users t ON t.id = gc.tutor_id",
  "LEFT JOIN public.live_sessions ls ON ls.group_class_id = gc.id",
].join(" ");

// Load the total and current page using the same database snapshot.
async function listRecords(req, res, mode) {
  res.set("Cache-Control", "no-store");

  if (req.user?.role !== "admin") {
    return fail(res, 403, "Administrator access required.");
  }

  let filters;

  try {
    filters = getFilters(req.query, mode);
  } catch {
    return fail(res, 400, "Invalid monitoring filters.");
  }

  try {
    const { values, where } = buildConditions(filters, mode);

    const isBooking = mode === "bookings";

    const select = isBooking ? bookingSelect : classSelect;
    const from = isBooking ? bookingFrom : classFrom;

    const order = isBooking
      ? "b.booking_date DESC, b.booking_time DESC, b.id DESC"
      : "gc.scheduled_at DESC, gc.id DESC";

    values.push(filters.limit);
    const limitParameter = "$" + values.length;

    values.push((filters.page - 1) * filters.limit);
    const offsetParameter = "$" + values.length;

    const sql = [
      "WITH page_rows AS (",
      "SELECT " + select + ",",
      "ROW_NUMBER() OVER (ORDER BY " + order + ") AS row_order",
      from,
      where,
      "ORDER BY " + order,
      "LIMIT " + limitParameter,
      "OFFSET " + offsetParameter,
      ")",
      "SELECT",
      "(SELECT COUNT(*) FROM (SELECT 1 " + from + " " + where + ") matched) AS total,",
      "COALESCE(",
      "(SELECT jsonb_agg(to_jsonb(p) - 'row_order' ORDER BY p.row_order) FROM page_rows p),",
      "'[]'::jsonb",
      ") AS records",
    ].join(" ");

    const result = await pool.query({
      text: sql,
      values,
      query_timeout: 15000,
    });

    if (result.rowCount !== 1 || result.rows.length !== 1) {
      throw new Error("Invalid monitoring result.");
    }

    const row = result.rows[0];
    const total = parseDatabaseCount(row.total);

    if (
      !Number.isSafeInteger(total) ||
      total < 0 ||
      !Array.isArray(row.records) ||
      row.records.length !== Math.min(
        filters.limit,
        Math.max(0, total - (filters.page - 1) * filters.limit)
      )
    ) {
      throw new Error("Invalid monitoring result.");
    }

    const totalPages = Math.ceil(total / filters.limit);

    return res.status(200).json({
      success: true,
      [mode]: row.records,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages,
        hasNextPage: filters.page < totalPages,
        hasPreviousPage: filters.page > 1,
      },
    });

  } catch {
    console.error("Administrator monitoring request failed.");

    return fail(
      res,
      503,
      "Monitoring information temporarily unavailable."
    );
  }
}

async function getAdminBookings(req, res) {
  return listRecords(req, res, "bookings");
}

async function getAdminGroupClasses(req, res) {
  return listRecords(req, res, "groupClasses");
}

module.exports = {
  getAdminBookings,
  getAdminGroupClasses,
};
