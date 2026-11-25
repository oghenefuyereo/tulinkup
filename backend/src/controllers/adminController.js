"use strict";

// Import the PostgreSQL connection pool.
const pool = require("../config/db");

const {
  parseDatabaseCount,
} = require("../services/adminStatisticsValidation");

// Retrieve administrator dashboard statistics.
async function getAdminDashboard(req, res) {

  // Prevent caching of administrator responses.
  res.set("Cache-Control", "no-store");

  // Verify administrator authorization.
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      error: "Administrator access required."
    });
  }

  try {

    // Retrieve aggregate platform statistics.
    const result = await pool.query(`
      SELECT
        (
          SELECT COUNT(*)
          FROM public.users
        ) AS total_users,

        (
          SELECT COUNT(*)
          FROM public.users
          WHERE role = 'student'
        ) AS total_students,

        (
          SELECT COUNT(*)
          FROM public.users
          WHERE role = 'tutor'
        ) AS total_tutors,

        (
          SELECT COUNT(*)
          FROM public.users
          WHERE role = 'admin'
        ) AS total_admins,

        (
          SELECT COUNT(*)
          FROM public.users
          WHERE account_status = 'active'
        ) AS active_accounts,

        (
          SELECT COUNT(*)
          FROM public.users
          WHERE account_status = 'suspended'
        ) AS suspended_accounts,

        (
          SELECT COUNT(*)
          FROM public.users
          WHERE account_status = 'removed'
        ) AS removed_accounts,

        (
          SELECT COUNT(*)
          FROM public.tutor_profiles
          WHERE approval_status = 'pending'
        ) AS pending_tutor_approvals,

        (
          SELECT COUNT(*)
          FROM public.tutor_profiles
          WHERE approval_status = 'approved'
        ) AS approved_tutors,

        (
          SELECT COUNT(*)
          FROM public.tutor_profiles
          WHERE approval_status = 'rejected'
        ) AS rejected_tutors,

        (
          SELECT COUNT(*)
          FROM public.bookings
        ) AS total_bookings,

        (
          SELECT COUNT(*)
          FROM public.group_classes
        ) AS total_group_classes,

        (
          SELECT COUNT(*)
          FROM public.group_class_enrollments
        ) AS total_group_enrollments,

        (
          SELECT COUNT(*)
          FROM public.live_sessions
        ) AS total_live_sessions
    `);

    const row = result.rows[0];

    // Convert PostgreSQL COUNT values to safe integers.
    function count(value) {
      return parseDatabaseCount(value);
    }

    // Organize statistics into dashboard categories.
    const statistics = {

      users: {
        total: count(row.total_users),
        students: count(row.total_students),
        tutors: count(row.total_tutors),
        administrators: count(row.total_admins),
        active: count(row.active_accounts),
        suspended: count(row.suspended_accounts),
        removed: count(row.removed_accounts)
      },

      tutorApprovals: {
        pending: count(row.pending_tutor_approvals),
        approved: count(row.approved_tutors),
        rejected: count(row.rejected_tutors)
      },

      bookings: {
        total: count(row.total_bookings)
      },

      groupClasses: {
        total: count(row.total_group_classes),
        enrollments: count(row.total_group_enrollments)
      },

      liveSessions: {
        total: count(row.total_live_sessions)
      }

    };

    // Return verified aggregate statistics.
    return res.status(200).json({
      success: true,
      message: "Welcome to the TuLinkUp admin dashboard.",
      statistics,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {

    // Do not expose internal database errors.
    console.error(
      "Administrator dashboard statistics retrieval failed."
    );

    return res.status(503).json({
      success: false,
      error: "Dashboard statistics temporarily unavailable."
    });

  }
}

// Export administrator controller functions.

// Retrieve a paginated list of registered users.
async function getAdminUsers(req, res) {

  // Prevent caching of confidential account information.
  res.set("Cache-Control", "no-store");

  // Verify administrator authorization.
  if (!req.user || req.user.role !== "admin") {

    return res.status(403).json({
      success: false,
      error: "Administrator access required."
    });

  }

  // Validate positive integer pagination parameters.
  function parsePositiveInteger(value, fallback, maximum) {

    if (value === undefined) return fallback;

    if (
      typeof value !== "string" ||
      !/^[1-9][0-9]*$/.test(value)
    ) {

      return null;

    }

    const number = Number(value);

    if (
      !Number.isSafeInteger(number) ||
      number > maximum
    ) {

      return null;

    }

    return number;

  }

  const page = parsePositiveInteger(
    req.query.page, 1, 10000
  );

  const limit = parsePositiveInteger(
    req.query.limit, 20, 100
  );

  if (page === null || limit === null) {

    return res.status(400).json({
      success: false,
      error: "Invalid pagination parameters."
    });

  }

  // Validate optional search and filtering parameters.
  const search = req.query.search;
  const role = req.query.role;
  const status = req.query.status;

  if (
    search !== undefined &&
    (
      typeof search !== "string" ||
      search.length > 100 ||
      /[\x00-\x1F\x7F]/.test(search)
    )
  ) {

    return res.status(400).json({
      success: false,
      error: "Invalid search parameter."
    });

  }

  if (
    role !== undefined &&
    !["student", "tutor", "admin"].includes(role)
  ) {

    return res.status(400).json({
      success: false,
      error: "Invalid role filter."
    });

  }

  if (
    status !== undefined &&
    !["active", "suspended", "removed"].includes(status)
  ) {

    return res.status(400).json({
      success: false,
      error: "Invalid account status filter."
    });

  }

  const offset = (page - 1) * limit;

  // Build parameterized search and filter conditions.
  const conditions = [];
  const values = [];

  if (search !== undefined && search.trim() !== "") {

    // Escape SQL LIKE wildcard characters.
    const escapedSearch = search.trim().replace(
      /[!%_]/g,
      character => "!" + character
    );

    values.push("%" + escapedSearch + "%");

    const parameter = "$" + values.length;

    conditions.push(
      "(full_name ILIKE " + parameter +
      " ESCAPE '!' OR email ILIKE " + parameter +
      " ESCAPE '!')"
    );

  }

  if (role !== undefined) {

    values.push(role);

    conditions.push(
      "role = $" + values.length
    );

  }

  if (status !== undefined) {

    values.push(status);

    conditions.push(
      "account_status = $" + values.length
    );

  }

  const whereClause = conditions.length
    ? " WHERE " + conditions.join(" AND ")
    : "";

  let client;
  let transactionStarted = false;
  let discardClient = false;
  let connectionFailed = false;

  // Discard connections that fail during a database transaction.
  function handleConnectionError() {
    connectionFailed = true;
    discardClient = true;
  }

  try {

    client = await pool.connect();

    client.on("error", handleConnectionError);

    // Discard the connection if transaction startup fails.
    discardClient = true;

    const beginResult = await client.query(
      "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"
    );

    if (
      connectionFailed ||
      beginResult?.command !== "BEGIN"
    ) {
      throw new Error("Unable to start read-only transaction.");
    }

    discardClient = false;

    transactionStarted = true;

    // Limit how long database statements and locks can wait.
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query(
      "SET LOCAL idle_in_transaction_session_timeout = '30s'"
    );

    // Count only users matching the requested filters.
    const countResult = await client.query(
      "SELECT COUNT(*) AS total FROM public.users" +
      whereClause,
      values
    );

    const total = parseDatabaseCount(countResult.rows[0].total);

    if (!Number.isSafeInteger(total) || total < 0) {

      throw new Error("Invalid user count.");

    }

    const limitParameter = "$" + (values.length + 1);
    const offsetParameter = "$" + (values.length + 2);

    // Retrieve only permitted account fields.
    const usersResult = await client.query(
      "SELECT id, full_name, email, role, " +
      "account_status, created_at FROM public.users" +
      whereClause +
      " ORDER BY created_at DESC, id DESC" +
      " LIMIT " + limitParameter +
      " OFFSET " + offsetParameter,
      [...values, limit, offset]
    );

    const users = usersResult.rows.map(user => ({
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      accountStatus: user.account_status,
      createdAt: user.created_at
    }));

    const totalPages = Math.ceil(total / limit);

    if (discardClient) {
      throw new Error("Database connection unavailable.");
    }

    // Verify that PostgreSQL completed the transaction.
    let commitResult;

    // Discard the connection if commit cannot be verified.
    try {
      commitResult = await client.query("COMMIT");
    } catch (error) {
      discardClient = true;
      throw error;
    }

    if (
      discardClient ||
      commitResult?.command !== "COMMIT"
    ) {
      discardClient = true;
      throw new Error("Read-only transaction was not committed.");
    }

    transactionStarted = false;

    return res.status(200).json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1 && totalPages > 0
      }
    });

  } catch (error) {

    if (client && transactionStarted) {

      try {

        if (discardClient) {
          throw new Error("Database connection unavailable.");
        }

        const rollbackResult = await client.query("ROLLBACK");

        if (
          discardClient ||
          rollbackResult?.command !== "ROLLBACK"
        ) {
          throw new Error("Database rollback failed.");
        }

        transactionStarted = false;

      } catch (rollbackError) {

        discardClient = true;

        console.error(
          "Administrator user listing rollback failed."
        );

      }

    }

    console.error(
      "Administrator user listing retrieval failed."
    );

    return res.status(503).json({
      success: false,
      error: "User listing temporarily unavailable."
    });

  } finally {

    if (client) {

      client.release(discardClient);

      // Keep failed connections protected during shutdown.
      if (!discardClient) {
        client.removeListener("error", handleConnectionError);
      }

    }

  }

}



async function getAdminUserById(req, res) {

  res.set("Cache-Control", "no-store");

  if (!req.user || req.user.role !== "admin") {

    return res.status(403).json({
      success: false,
      error: "Administrator access required."
    });

  }

  const userId = req.params.id;

  // PostgreSQL bigint maximum positive value.
  const MAX_BIGINT = 9223372036854775807n;

  if (
    typeof userId !== "string" ||
    userId.length > 19 ||
    !/^[1-9][0-9]*$/.test(userId)
  ) {

    return res.status(400).json({
      success: false,
      error: "Invalid account ID."
    });

  }

  if (BigInt(userId) > MAX_BIGINT) {

    return res.status(400).json({
      success: false,
      error: "Invalid account ID."
    });

  }

  try {

    const result = await pool.query(
      "SELECT id, full_name, email, phone, role, " +
      "account_status, created_at " +
      "FROM public.users " +
      "WHERE id = $1::bigint",
      [userId]
    );

    if (result.rows.length === 0) {

      return res.status(404).json({
        success: false,
        error: "Account not found."
      });

    }

    const account = result.rows[0];

    return res.status(200).json({
      success: true,
      user: {
        id: account.id,
        fullName: account.full_name,
        email: account.email,
        phone: account.phone,
        role: account.role,
        accountStatus: account.account_status,
        createdAt: account.created_at
      }
    });

  } catch (error) {

    console.error(
      "Administrator account details retrieval failed."
    );

    return res.status(503).json({
      success: false,
      error: "Account details temporarily unavailable."
    });

  }

}



async function getAdminStudents(req, res) {

  res.set("Cache-Control", "no-store");

  if (!req.user || req.user.role !== "admin") {

    return res.status(403).json({
      success: false,
      error: "Administrator access required."
    });

  }

  function parsePositiveInteger(
    value,
    fallback,
    maximum
  ) {

    if (value === undefined) {

      return fallback;

    }

    if (
      typeof value !== "string" ||
      !/^[1-9][0-9]*$/.test(value)
    ) {

      return null;

    }

    const number = Number(value);

    if (
      !Number.isSafeInteger(number) ||
      number > maximum
    ) {

      return null;

    }

    return number;

  }

  const page = parsePositiveInteger(
    req.query.page,
    1,
    10000
  );

  const limit = parsePositiveInteger(
    req.query.limit,
    20,
    100
  );

  if (page === null || limit === null) {

    return res.status(400).json({
      success: false,
      error: "Invalid pagination parameters."
    });

  }

  const search = req.query.search;
  const status = req.query.status;

  if (
    search !== undefined &&
    (
      typeof search !== "string" ||
      search.length > 100 ||
      /[\x00-\x1F\x7F]/.test(search)
    )
  ) {

    return res.status(400).json({
      success: false,
      error: "Invalid search parameter."
    });

  }

  if (
    status !== undefined &&
    !["active", "suspended", "removed"]
      .includes(status)
  ) {

    return res.status(400).json({
      success: false,
      error: "Invalid account status filter."
    });

  }

  const offset = (page - 1) * limit;

  const conditions = [
    "u.role = $1"
  ];

  const values = ["student"];

  if (
    search !== undefined &&
    search.trim() !== ""
  ) {

    const escapedSearch = search
      .trim()
      .replace(
        /[!%_]/g,
        character => "!" + character
      );

    values.push(
      "%" + escapedSearch + "%"
    );

    const parameter = "$" + values.length;

    conditions.push(
      "(u.full_name ILIKE " +
      parameter +
      " ESCAPE '!' OR u.email ILIKE " +
      parameter +
      " ESCAPE '!')"
    );

  }

  if (status !== undefined) {

    values.push(status);

    conditions.push(
      "u.account_status = $" + values.length
    );

  }

  const whereClause =
    " WHERE " + conditions.join(" AND ");

  let client;
  let transactionStarted = false;
  let discardClient = false;
  let connectionFailed = false;

  // Discard connections that fail during a database transaction.
  function handleConnectionError() {
    connectionFailed = true;
    discardClient = true;
  }

  function parseCount(value) {
    return parseDatabaseCount(value);
  }

  try {

    client = await pool.connect();

    client.on("error", handleConnectionError);

    // Discard the connection if transaction startup fails.
    discardClient = true;

    const beginResult = await client.query(
      "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"
    );

    if (
      connectionFailed ||
      beginResult?.command !== "BEGIN"
    ) {
      throw new Error("Unable to start read-only transaction.");
    }

    discardClient = false;

    transactionStarted = true;

    // Limit how long database statements and locks can wait.
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query(
      "SET LOCAL idle_in_transaction_session_timeout = '30s'"
    );

    const countResult = await client.query(
      "SELECT COUNT(*) AS total " +
      "FROM public.users u" +
      whereClause,
      values
    );

    const total = parseCount(
      countResult.rows[0].total
    );

    const limitParameter =
      "$" + (values.length + 1);

    const offsetParameter =
      "$" + (values.length + 2);

    const studentsResult = await client.query(

      "WITH paginated_students AS (" +

        " SELECT u.id, u.full_name, u.email," +
        " u.role, u.account_status, u.created_at" +
        " FROM public.users u" +
        whereClause +
        " ORDER BY u.created_at DESC, u.id DESC" +
        " LIMIT " + limitParameter +
        " OFFSET " + offsetParameter +

      ")" +

      " SELECT" +
      " s.id, s.full_name, s.email," +
      " s.role, s.account_status, s.created_at," +

      " (SELECT COUNT(*) FROM public.bookings b" +
      " WHERE b.student_id = s.id)" +
      " AS total_bookings," +

      " (SELECT COUNT(*)" +
      " FROM public.group_class_enrollments gce" +
      " WHERE gce.student_id = s.id)" +
      " AS total_group_enrollments" +

      " FROM paginated_students s" +
      " ORDER BY s.created_at DESC, s.id DESC",

      [...values, limit, offset]

    );

    const students = studentsResult.rows.map(
      student => ({

        id: student.id,

        fullName: student.full_name,

        email: student.email,

        role: student.role,

        accountStatus: student.account_status,

        createdAt: student.created_at,

        totalBookings: parseCount(
          student.total_bookings
        ),

        totalGroupEnrollments: parseCount(
          student.total_group_enrollments
        )

      })
    );

    const totalPages = Math.ceil(
      total / limit
    );

    if (discardClient) {
      throw new Error("Database connection unavailable.");
    }

    // Verify that PostgreSQL completed the transaction.
    let commitResult;

    // Discard the connection if commit cannot be verified.
    try {
      commitResult = await client.query("COMMIT");
    } catch (error) {
      discardClient = true;
      throw error;
    }

    if (
      discardClient ||
      commitResult?.command !== "COMMIT"
    ) {
      discardClient = true;
      throw new Error("Read-only transaction was not committed.");
    }

    transactionStarted = false;

    return res.status(200).json({

      success: true,

      students,

      pagination: {

        page,

        limit,

        total,

        totalPages,

        hasNextPage: page < totalPages,

        hasPreviousPage:
          page > 1 && totalPages > 0

      }

    });

  } catch (error) {

    if (client && transactionStarted) {

      try {

        if (discardClient) {
          throw new Error("Database connection unavailable.");
        }

        const rollbackResult = await client.query("ROLLBACK");

        if (
          discardClient ||
          rollbackResult?.command !== "ROLLBACK"
        ) {
          throw new Error("Database rollback failed.");
        }

        transactionStarted = false;

      } catch (rollbackError) {

        discardClient = true;

        console.error(
          "Administrator student listing rollback failed."
        );

      }

    }

    console.error(
      "Administrator student listing retrieval failed."
    );

    return res.status(503).json({

      success: false,

      error: "Student listing temporarily unavailable."

    });

  } finally {

    if (client) {

      client.release(discardClient);

      // Keep failed connections protected during shutdown.
      if (!discardClient) {
        client.removeListener("error", handleConnectionError);
      }

    }

  }

}




async function getAdminTutors(req, res) {

  res.set("Cache-Control", "no-store");

  if (!req.user || req.user.role !== "admin") {

    return res.status(403).json({
      success: false,
      error: "Administrator access required."
    });

  }

  function parsePositiveInteger(
    value,
    fallback,
    maximum
  ) {

    if (value === undefined) {

      return fallback;

    }

    if (
      typeof value !== "string" ||
      !/^[1-9][0-9]*$/.test(value)
    ) {

      return null;

    }

    const number = Number(value);

    if (
      !Number.isSafeInteger(number) ||
      number > maximum
    ) {

      return null;

    }

    return number;

  }

  const page = parsePositiveInteger(
    req.query.page,
    1,
    10000
  );

  const limit = parsePositiveInteger(
    req.query.limit,
    20,
    100
  );

  if (page === null || limit === null) {

    return res.status(400).json({
      success: false,
      error: "Invalid pagination parameters."
    });

  }

  const search = req.query.search;
  const status = req.query.status;
  const approvalStatus = req.query.approvalStatus;

  if (
    search !== undefined &&
    (
      typeof search !== "string" ||
      search.length > 100 ||
      /[\x00-\x1F\x7F]/.test(search)
    )
  ) {

    return res.status(400).json({
      success: false,
      error: "Invalid search parameter."
    });

  }

  if (
    status !== undefined &&
    !["active", "suspended", "removed"]
      .includes(status)
  ) {

    return res.status(400).json({
      success: false,
      error: "Invalid account status filter."
    });

  }

  if (
    approvalStatus !== undefined &&
    ![
      "pending",
      "approved",
      "rejected",
      "no_profile"
    ].includes(approvalStatus)
  ) {

    return res.status(400).json({
      success: false,
      error: "Invalid tutor approval status filter."
    });

  }

  const offset = (page - 1) * limit;

  const conditions = [
    "u.role = $1"
  ];

  const values = ["tutor"];

  if (
    search !== undefined &&
    search.trim() !== ""
  ) {

    const escapedSearch = search
      .trim()
      .replace(
        /[!%_]/g,
        character => "!" + character
      );

    values.push(
      "%" + escapedSearch + "%"
    );

    const parameter = "$" + values.length;

    conditions.push(
      "(u.full_name ILIKE " +
      parameter +
      " ESCAPE '!' OR u.email ILIKE " +
      parameter +
      " ESCAPE '!')"
    );

  }

  if (status !== undefined) {

    values.push(status);

    conditions.push(
      "u.account_status = $" + values.length
    );

  }

  if (approvalStatus === "no_profile") {

    conditions.push("tp.id IS NULL");

  } else if (approvalStatus !== undefined) {

    values.push(approvalStatus);

    conditions.push(
      "tp.approval_status = $" + values.length
    );

  }

  const fromClause =
    " FROM public.users u" +
    " LEFT JOIN public.tutor_profiles tp" +
    " ON tp.user_id = u.id";

  const whereClause =
    " WHERE " + conditions.join(" AND ");

  function parseCount(value) {
    return parseDatabaseCount(value);
  }

  function parseNullableNumber(
    value,
    minimum,
    maximum
  ) {

    if (value === null) {

      return null;

    }

    if (
      typeof value !== "number" &&
      (
        typeof value !== "string" ||
        value.trim() === ""
      )
    ) {

      throw new Error("Invalid tutor profile statistic.");

    }

    const number = Number(value);

    if (
      !Number.isFinite(number) ||
      number < minimum ||
      number > maximum
    ) {

      throw new Error("Invalid tutor profile statistic.");

    }

    return number;

  }

  let client;
  let transactionStarted = false;
  let discardClient = false;
  let connectionFailed = false;

  // Discard connections that fail during a database transaction.
  function handleConnectionError() {
    connectionFailed = true;
    discardClient = true;
  }

  try {

    client = await pool.connect();

    client.on("error", handleConnectionError);

    // Discard the connection if transaction startup fails.
    discardClient = true;

    const beginResult = await client.query(
      "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"
    );

    if (
      connectionFailed ||
      beginResult?.command !== "BEGIN"
    ) {
      throw new Error("Unable to start read-only transaction.");
    }

    discardClient = false;

    transactionStarted = true;

    // Limit how long database statements and locks can wait.
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query(
      "SET LOCAL idle_in_transaction_session_timeout = '30s'"
    );

    const countResult = await client.query(

      "SELECT COUNT(*) AS total" +
      fromClause +
      whereClause,

      values

    );

    const total = parseCount(
      countResult.rows[0].total
    );

    const limitParameter =
      "$" + (values.length + 1);

    const offsetParameter =
      "$" + (values.length + 2);

    const tutorsResult = await client.query(

      "WITH paginated_tutors AS (" +

        " SELECT u.id, u.full_name, u.email," +
        " u.role, u.account_status, u.created_at," +

        " tp.id AS profile_id," +
        " (tp.id IS NOT NULL) AS has_profile," +

        " tp.approval_status," +
        " tp.availability_status," +
        " tp.hourly_rate," +
        " tp.rating," +
        " tp.review_count" +

        fromClause +
        whereClause +

        " ORDER BY u.created_at DESC, u.id DESC" +

        " LIMIT " + limitParameter +
        " OFFSET " + offsetParameter +

      ")" +

      " SELECT" +

      " t.id, t.full_name, t.email," +
      " t.role, t.account_status, t.created_at," +

      " t.profile_id," +
      " t.has_profile," +
      " t.approval_status," +
      " t.availability_status," +
      " t.hourly_rate," +
      " t.rating," +
      " t.review_count," +

      " (SELECT COUNT(*) FROM public.bookings b" +
      " WHERE b.tutor_id = t.id)" +
      " AS total_bookings," +

      " (SELECT COUNT(*) FROM public.group_classes gc" +
      " WHERE gc.tutor_id = t.id)" +
      " AS total_group_classes" +

      " FROM paginated_tutors t" +

      " ORDER BY t.created_at DESC, t.id DESC",

      [...values, limit, offset]

    );

    const tutors = tutorsResult.rows.map(
      tutor => ({

        id: tutor.id,

        fullName: tutor.full_name,

        email: tutor.email,

        role: tutor.role,

        accountStatus: tutor.account_status,

        createdAt: tutor.created_at,

        hasProfile: tutor.has_profile,

        profileId:
          tutor.profile_id === null
            ? null
            : String(tutor.profile_id),

        approvalStatus: tutor.approval_status,

        availabilityStatus: tutor.availability_status,

        hourlyRate: parseNullableNumber(
          tutor.hourly_rate,
          0,
          25
        ),

        rating: parseNullableNumber(
          tutor.rating,
          0,
          5
        ),

        reviewCount:
          tutor.review_count === null
            ? null
            : parseCount(tutor.review_count),

        totalBookings: parseCount(
          tutor.total_bookings
        ),

        totalGroupClasses: parseCount(
          tutor.total_group_classes
        )

      })
    );

    const totalPages = Math.ceil(
      total / limit
    );

    if (discardClient) {
      throw new Error("Database connection unavailable.");
    }

    // Verify that PostgreSQL completed the transaction.
    let commitResult;

    // Discard the connection if commit cannot be verified.
    try {
      commitResult = await client.query("COMMIT");
    } catch (error) {
      discardClient = true;
      throw error;
    }

    if (
      discardClient ||
      commitResult?.command !== "COMMIT"
    ) {
      discardClient = true;
      throw new Error("Read-only transaction was not committed.");
    }

    transactionStarted = false;

    return res.status(200).json({

      success: true,

      tutors,

      pagination: {

        page,

        limit,

        total,

        totalPages,

        hasNextPage: page < totalPages,

        hasPreviousPage:
          page > 1 && totalPages > 0

      }

    });

  } catch (error) {

    if (client && transactionStarted) {

      try {

        if (discardClient) {
          throw new Error("Database connection unavailable.");
        }

        const rollbackResult = await client.query("ROLLBACK");

        if (
          discardClient ||
          rollbackResult?.command !== "ROLLBACK"
        ) {
          throw new Error("Database rollback failed.");
        }

        transactionStarted = false;

      } catch (rollbackError) {

        discardClient = true;

        console.error(
          "Administrator tutor listing rollback failed."
        );

      }

    }

    console.error(
      "Administrator tutor listing retrieval failed."
    );

    return res.status(503).json({

      success: false,

      error: "Tutor listing temporarily unavailable."

    });

  } finally {

    if (client) {

      client.release(discardClient);

      // Keep failed connections protected during shutdown.
      if (!discardClient) {
        client.removeListener("error", handleConnectionError);
      }

    }

  }

}


module.exports = {
  getAdminDashboard,
  getAdminUsers,
  getAdminUserById,
  getAdminStudents,
  getAdminTutors
};
