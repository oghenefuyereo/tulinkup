const bookingStatuses = [
  "pending", "accepted", "declined", "cancelled", "completed",
];

const classStatuses = [
  "draft", "published", "live", "completed", "cancelled",
];

const paymentStatuses = [
  "unpaid", "pending", "paid", "failed", "refunded", "not_required",
];

const sessionStatuses = [
  "scheduled", "live", "completed", "cancelled",
];

function validId(value) {
  return typeof value === "string" &&
    /^[1-9][0-9]{0,18}$/.test(value) &&
    BigInt(value) <= 9223372036854775807n;
}

function validCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validDateTime(value) {
  return typeof value === "string" &&
    Number.isFinite(Date.parse(value));
}

function validDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) return false;

  const date = new Date(value + "T00:00:00Z");

  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function validObject(value) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function invalid() {
  throw new Error("Invalid monitoring response.");
}

function validatePagination(value, query, length) {
  if (!validObject(value)) {
    invalid();
  }

  const page = Number(query.get("page") ?? "1");
  const limit = Number(query.get("limit") ?? "20");

  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 10000 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    value.page !== page ||
    value.limit !== limit ||
    !validCount(value.total) ||
    !validCount(value.totalPages) ||
    value.totalPages !== Math.ceil(value.total / limit) ||
    value.hasNextPage !== (page < value.totalPages) ||
    value.hasPreviousPage !== (page > 1) ||
    length !== Math.min(
      limit,
      Math.max(0, value.total - (page - 1) * limit)
    )
  ) {
    invalid();
  }

  return {
    page: value.page,
    limit: value.limit,
    total: value.total,
    totalPages: value.totalPages,
    hasNextPage: value.hasNextPage,
    hasPreviousPage: value.hasPreviousPage,
  };
}

// Validate monitoring records before sending them to the browser.
function validRecord(record, isBooking) {
  if (
    !record ||
    !validId(record.id) ||
    !validId(record.tutorId) ||
    typeof record.tutorName !== "string" ||
    typeof record.subject !== "string" ||
    !validDateTime(record.createdAt) ||
    !(record.sessionStatus === null ||
      sessionStatuses.includes(record.sessionStatus))
  ) return false;

  if (isBooking) {
    return validId(record.studentId) &&
      typeof record.studentName === "string" &&
      validDate(record.date) &&
      typeof record.startTime === "string" &&
      /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,6})?)?$/.test(record.startTime) &&
      [30, 60, 90].includes(record.durationMinutes) &&
      bookingStatuses.includes(record.status) &&
      (record.totalPriceCents === null ||
        validCount(record.totalPriceCents)) &&
      (record.currency === null || record.currency === "CAD") &&
      (record.paymentStatus === null ||
        paymentStatuses.includes(record.paymentStatus));
  }

  return typeof record.title === "string" &&
    typeof record.educationLevel === "string" &&
    validDateTime(record.scheduledAt) &&
    Number.isInteger(record.durationMinutes) &&
    record.durationMinutes >= 15 &&
    record.durationMinutes <= 180 &&
    classStatuses.includes(record.status) &&
    validCount(record.priceCents) &&
    record.priceCents <= 1000 &&
    record.currency === "CAD" &&
    Number.isInteger(record.minimumStudents) &&
    record.minimumStudents >= 1 &&
    Number.isInteger(record.maximumStudents) &&
    record.maximumStudents >= 2 &&
    record.maximumStudents <= 20 &&
    record.minimumStudents <= record.maximumStudents &&
    record.priceCents * record.maximumStudents <= 10000 &&
    validCount(record.totalEnrollments) &&
    validCount(record.enrolledStudents) &&
    validCount(record.confirmedStudents) &&
    record.confirmedStudents <= record.enrolledStudents &&
    record.enrolledStudents <= record.totalEnrollments;
}

const bookingFields = [
  "id",
  "studentId",
  "tutorId",
  "studentName",
  "tutorName",
  "subject",
  "date",
  "startTime",
  "durationMinutes",
  "status",
  "totalPriceCents",
  "currency",
  "paymentStatus",
  "sessionStatus",
  "createdAt",
];

const groupClassFields = [
  "id",
  "tutorId",
  "tutorName",
  "title",
  "subject",
  "educationLevel",
  "scheduledAt",
  "durationMinutes",
  "priceCents",
  "currency",
  "minimumStudents",
  "maximumStudents",
  "status",
  "sessionStatus",
  "createdAt",
  "totalEnrollments",
  "enrolledStudents",
  "confirmedStudents",
];

// Return only verified monitoring information.
export function validateAdminMonitoringResponse(data, mode, query) {
  if (
    !["bookings", "groupClasses"].includes(mode) ||
    !validObject(data) ||
    data.success !== true ||
    !Array.isArray(data[mode]) ||
    data[mode].length > 100
  ) {
    invalid();
  }

  const isBooking = mode === "bookings";
  const fields = isBooking ? bookingFields : groupClassFields;

  const records = data[mode].map(record => {
    if (
      !validObject(record) ||
      !fields.every(field => Object.hasOwn(record, field)) ||
      !validRecord(record, isBooking)
    ) {
      invalid();
    }

    const status = query.get("status");
    const paymentStatus = query.get("paymentStatus");
    const sessionStatus = query.get("sessionStatus");

    if (status && record.status !== status) {
      invalid();
    }

    if (
      paymentStatus &&
      (!isBooking || record.paymentStatus !== paymentStatus)
    ) {
      invalid();
    }

    if (
      sessionStatus === "no_session" &&
      record.sessionStatus !== null
    ) {
      invalid();
    }

    if (
      sessionStatus &&
      sessionStatus !== "no_session" &&
      record.sessionStatus !== sessionStatus
    ) {
      invalid();
    }

    return Object.fromEntries(
      fields.map(field => [field, record[field]])
    );
  });

  if (
    new Set(records.map(record => record.id)).size !== records.length
  ) {
    invalid();
  }

  const pagination = validatePagination(
    data.pagination,
    query,
    records.length
  );

  return {
    success: true,
    [mode]: records,
    pagination,
  };
}
