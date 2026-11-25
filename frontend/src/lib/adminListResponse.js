const roles = ["student", "tutor", "admin"];

const statuses = ["active", "suspended", "removed"];

const approvals = ["pending", "approved", "rejected"];

function validId(value) {
  return typeof value === "string" &&
    /^[1-9]\d{0,18}$/.test(value) &&
    BigInt(value) <= 9223372036854775807n;
}

function validCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validObject(value) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function validText(value) {
  return typeof value === "string" &&
    value.trim().length > 0;
}

function validDate(value) {
  return typeof value === "string" &&
    Number.isFinite(Date.parse(value));
}

function validNullableNumber(value, maximum) {
  return value === null ||
    (typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= maximum);
}

function invalid() {
  throw new Error("Invalid administrator response.");
}

// Validate pagination against the original request.
export function validatePagination(value, query, length) {
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

// Return only the account information needed by administrators.
function validateAccount(record, mode, query) {
  if (
    !validObject(record) ||
    !validId(record.id) ||
    !validText(record.fullName) ||
    !validText(record.email) ||
    !roles.includes(record.role) ||
    !statuses.includes(record.accountStatus) ||
    !validDate(record.createdAt)
  ) {
    invalid();
  }

  const expectedRole = mode === "students"
    ? "student"
    : mode === "tutors"
      ? "tutor"
      : query.get("role");

  if (
    expectedRole &&
    record.role !== expectedRole
  ) {
    invalid();
  }

  if (
    query.has("status") &&
    record.accountStatus !== query.get("status")
  ) {
    invalid();
  }

  const account = {
    id: record.id,
    fullName: record.fullName,
    email: record.email,
    role: record.role,
    accountStatus: record.accountStatus,
    createdAt: record.createdAt,
  };

  if (mode === "students") {
    if (
      !validCount(record.totalBookings) ||
      !validCount(record.totalGroupEnrollments)
    ) {
      invalid();
    }

    return {
      ...account,
      totalBookings: record.totalBookings,
      totalGroupEnrollments: record.totalGroupEnrollments,
    };
  }

  if (mode === "tutors") {
    return validateTutor(account, record, query);
  }

  return account;
}

// Validate tutor profile information and activity counts.
function validateTutor(account, record, query) {
  if (
    typeof record.hasProfile !== "boolean" ||
    !validCount(record.totalBookings) ||
    !validCount(record.totalGroupClasses) ||
    !validNullableNumber(record.hourlyRate, 25) ||
    !validNullableNumber(record.rating, 5) ||
    (
      record.reviewCount !== null &&
      !validCount(record.reviewCount)
    ) ||
    (
      record.availabilityStatus !== null &&
      typeof record.availabilityStatus !== "string"
    )
  ) {
    invalid();
  }

  if (record.hasProfile) {
    if (
      !validId(record.profileId) ||
      !approvals.includes(record.approvalStatus)
    ) {
      invalid();
    }
  } else if (
    record.profileId !== null ||
    record.approvalStatus !== null
  ) {
    invalid();
  }

  const approval = query.get("approvalStatus");

  if (
    approval === "no_profile" &&
    record.hasProfile
  ) {
    invalid();
  }

  if (
    approval &&
    approval !== "no_profile" &&
    record.approvalStatus !== approval
  ) {
    invalid();
  }

  return {
    ...account,
    hasProfile: record.hasProfile,
    profileId: record.profileId,
    approvalStatus: record.approvalStatus,
    availabilityStatus: record.availabilityStatus,
    hourlyRate: record.hourlyRate,
    rating: record.rating,
    reviewCount: record.reviewCount,
    totalBookings: record.totalBookings,
    totalGroupClasses: record.totalGroupClasses,
  };
}

// Reject malformed responses before returning them to the browser.
export function validateAdminListResponse(data, mode, query) {
  if (
    !["users", "students", "tutors"].includes(mode) ||
    !validObject(data) ||
    data.success !== true ||
    !Array.isArray(data[mode]) ||
    data[mode].length > 100
  ) {
    invalid();
  }

  const records = data[mode].map(record =>
    validateAccount(record, mode, query)
  );

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
