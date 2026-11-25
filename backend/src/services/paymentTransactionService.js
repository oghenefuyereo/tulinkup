
"use strict";

const pool = require("../config/db");
const { randomUUID } = require("node:crypto");

const {
  authorizeStudent,
} = require("./paymentValidationService");

// Payment records that must prevent another payment attempt.
const ACTIVE_PAYMENT_STATUSES = Object.freeze([
  "pending",
  "processing",
  "paid",
  "partially_refunded",
  "disputed",
]);

// Payment types supported by TuLinkUp.
const PAYMENT_TYPES = Object.freeze([
  "one_on_one",
  "group",
]);

// Only sandbox payments are currently supported.
const LIVEMODE = false;

// Track database clients currently executing payment transactions.
const activeTransactionClients = new WeakSet();

// Track payment sources locked within each transaction.
const lockedPaymentSources = new WeakMap();

// Create an error that the payment controller can handle.
function paymentError(message, statusCode = 409) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// Validate a positive PostgreSQL database ID.
function validateId(value, name) {
  // Only accept strings or safe positive integers.
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    throw paymentError(`Invalid ${name}.`, 400);
  }

  // Reject unsafe numbers before converting to a string.
  if (
    typeof value === "number" &&
    (!Number.isSafeInteger(value) || value <= 0)
  ) {
    throw paymentError(`Invalid ${name}.`, 400);
  }

  const id = String(value);

  // Make sure the ID fits within PostgreSQL BIGINT.
  if (
    !/^[1-9]\d{0,18}$/.test(id) ||
    BigInt(id) > 9223372036854775807n
  ) {
    throw paymentError(`Invalid ${name}.`, 400);
  }

  return id;
}

// Verify that the requested payment type is supported.
function validatePaymentType(paymentType) {
  if (!PAYMENT_TYPES.includes(paymentType)) {
    throw paymentError("Invalid payment type.", 400);
  }

  return paymentType;
}

// Generate a unique key for a new payment attempt.
function generateIdempotencyKey(
  paymentType,
  sourceId
) {
  const type = validatePaymentType(paymentType);
  const id = validateId(sourceId, "payment source ID");

  return [
    "tulinkup",
    "sandbox",
    type,
    id,
    randomUUID(),
  ].join("-");
}

// Execute database operations inside a transaction.
async function withPaymentTransaction(
  callback,
  database = pool
) {
  if (typeof callback !== "function") {
    throw paymentError(
      "Invalid payment transaction callback.",
      500
    );
  }

  // Use one database connection throughout the transaction.
  const client = await database.connect();

  let transactionStarted = false;
  let commitStarted = false;
  let releaseError;

  // Keep connection errors handled until the client is released.
  const handleConnectionError = () => {
    releaseError = new Error(
      "Payment database connection failed."
    );
  };

  client.on("error", handleConnectionError);

  try {
    // Start the PostgreSQL transaction.
    const beginResult = await client.query("BEGIN");

    if (beginResult?.command !== "BEGIN" || releaseError) {
      throw paymentError(
        "Payment transaction could not be started.",
        503
      );
    }

    transactionStarted = true;

    // Prevent transactions from waiting indefinitely for locks.
    await client.query(
      "SET LOCAL lock_timeout = '5s'"
    );

    // Limit the duration of individual SQL statements.
    await client.query(
      "SET LOCAL statement_timeout = '15s'"
    );

    await client.query(
      "SET LOCAL idle_in_transaction_session_timeout = '30s'"
    );

    if (releaseError) {
      throw releaseError;
    }

    // Register the client as an active payment transaction.
    activeTransactionClients.add(client);

    // Start with an empty collection of locked payment sources.
    lockedPaymentSources.set(client, new Set());

    // Execute the requested payment operations.
    const result = await callback(client);

    // Stop accepting payment operations before committing.
    activeTransactionClients.delete(client);
    lockedPaymentSources.delete(client);

    // Save all successful database changes.
    commitStarted = true;

    if (releaseError) {
      throw releaseError;
    }

    const commitResult = await client.query("COMMIT");

    // Make sure PostgreSQL actually committed the transaction.
    // Missing or invalid responses require reconciliation.
    if (
      releaseError ||
      !commitResult ||
      commitResult.command !== "COMMIT"
    ) {
      throw paymentError(
        "Payment transaction was not committed.",
        500
      );
    }

    transactionStarted = false;
    commitStarted = false;

    return result;

  } catch (error) {
    // Prevent further payment operations on this client.
    activeTransactionClients.delete(client);
    lockedPaymentSources.delete(client);

    // A failed COMMIT may have an uncertain database outcome.
    // Discard the connection and require reconciliation.
    if (commitStarted) {
      releaseError = error;

      const commitError = paymentError(
        "Payment transaction outcome requires reconciliation.",
        503
      );

      commitError.code =
        "PAYMENT_COMMIT_UNCERTAIN";

      throw commitError;
    }

    // Undo database changes if the transaction fails.
    if (transactionStarted) {
      try {
        if (releaseError) {
          throw releaseError;
        }

        const rollbackResult = await client.query("ROLLBACK");

        if (
          releaseError ||
          rollbackResult?.command !== "ROLLBACK"
        ) {
          throw new Error(
            "Payment rollback could not be verified."
          );
        }
      } catch {
        releaseError = new Error(
          "Payment transaction rollback failed."
        );

        const rollbackError = paymentError(
          "Payment transaction could not be safely completed.",
          503
        );

        rollbackError.code = "PAYMENT_ROLLBACK_FAILED";

        throw rollbackError;
      }
    } else {
      // Discard the connection if BEGIN fails.
      releaseError = error;
    }

    throw error;

  } finally {
    // Remove the client from active transaction tracking.
    activeTransactionClients.delete(client);

    // Remove all payment source locks from transaction tracking.
    lockedPaymentSources.delete(client);

    // Always return or discard the database connection.
    client.release(releaseError);

    // Discarded connections can still emit shutdown errors.
    if (!releaseError) {
      client.removeListener("error", handleConnectionError);
    }
  }
}

// Require a dedicated client inside an active payment transaction.
function validateTransactionClient(client) {
  if (
    !client ||
    client === pool ||
    typeof client.query !== "function" ||
    typeof client.release !== "function"
  ) {
    throw paymentError(
      "A payment transaction client is required.",
      500
    );
  }

  // Reject clients outside the managed transaction lifecycle.
  if (!activeTransactionClients.has(client)) {
    throw paymentError(
      "An active payment transaction is required.",
      500
    );
  }
}

// Lock a private booking before preparing its payment.
async function lockBooking(
  bookingId,
  studentId,
  client
) {
  validateTransactionClient(client);

  const id = validateId(
    bookingId,
    "booking ID"
  );

  const ownerId = validateId(
    studentId,
    "student ID"
  );

  // Lock only the booking belonging to this student.
  const result = await client.query(
    `SELECT b.*,
       (
         (b.booking_date + b.booking_time)
         AT TIME ZONE 'America/Toronto'
       ) > clock_timestamp() AS is_future
     FROM public.bookings b
     WHERE b.id = $1
       AND b.student_id = $2
     FOR UPDATE OF b`,
    [id, ownerId]
  );

  if (!result.rows.length) {
    throw paymentError(
      "Booking not found.",
      404
    );
  }

  return result.rows[0];
}

// Lock the group class before locking its enrollment.
async function lockGroupEnrollment(
  enrollmentId,
  studentId,
  client
) {
  validateTransactionClient(client);

  const id = validateId(
    enrollmentId,
    "enrollment ID"
  );

  const ownerId = validateId(
    studentId,
    "student ID"
  );

  // Find the class associated with the student's enrollment.
  const reference = await client.query(
    `SELECT id, class_id
     FROM public.group_class_enrollments
     WHERE id = $1
       AND student_id = $2`,
    [id, ownerId]
  );

  if (!reference.rows.length) {
    throw paymentError(
      "Group enrollment not found.",
      404
    );
  }

  const classId = validateId(
    reference.rows[0].class_id,
    "group class ID"
  );

  // Lock the group class first to coordinate seat reservations.
  const classResult = await client.query(
    `SELECT c.*
     FROM public.group_classes c
     WHERE c.id = $1
     FOR UPDATE OF c`,
    [classId]
  );

  if (!classResult.rows.length) {
    throw paymentError(
      "Group class not found.",
      404
    );
  }

  // Lock the enrollment and verify that its class has not changed.
  const enrollmentResult = await client.query(
    `SELECT e.*
     FROM public.group_class_enrollments e
     WHERE e.id = $1
       AND e.student_id = $2
       AND e.class_id = $3
     FOR UPDATE OF e`,
    [id, ownerId, classId]
  );

  if (!enrollmentResult.rows.length) {
    throw paymentError(
      "Group enrollment not found or changed.",
      404
    );
  }

  return {
    groupClass: classResult.rows[0],
    enrollment: enrollmentResult.rows[0],
  };
}

// Register an authorized payment source after locking its rows.
function registerLockedPaymentSource(
  paymentType,
  sourceId,
  studentId,
  client
) {
  validateTransactionClient(client);

  const type = validatePaymentType(paymentType);

  const id = validateId(
    sourceId,
    "payment source ID"
  );

  const ownerId = validateId(
    studentId,
    "student ID"
  );

  const sources = lockedPaymentSources.get(client);

  // Make sure source tracking is available.
  if (!sources) {
    throw paymentError(
      "Payment source tracking is unavailable.",
      500
    );
  }

  // Identify the exact payment source and its student.
  const sourceKey = [
    type,
    id,
    ownerId,
  ].join(":");

  // Register the source within the current transaction.
  sources.add(sourceKey);
}

// Verify that a payment source was locked in this transaction.
function requireLockedPaymentSource(
  paymentType,
  sourceId,
  studentId,
  client
) {
  validateTransactionClient(client);

  const type = validatePaymentType(paymentType);

  const id = validateId(
    sourceId,
    "payment source ID"
  );

  const ownerId = validateId(
    studentId,
    "student ID"
  );

  // Reconstruct the unique payment source identifier.
  const sourceKey = [
    type,
    id,
    ownerId,
  ].join(":");

  const sources = lockedPaymentSources.get(client);

  // Reject payment operations without a registered source lock.
  if (!sources || !sources.has(sourceKey)) {
    throw paymentError(
      "The payment source must be locked first.",
      500
    );
  }
}

// Authorize the student and lock the requested payment source.
async function lockPaymentSource(
  paymentType,
  sourceId,
  user,
  client
) {
  validateTransactionClient(client);

  const type = validatePaymentType(paymentType);

  const id = validateId(
    sourceId,
    "payment source ID"
  );

  // Verify the student's database account.
  const studentId = await authorizeStudent(
    user,
    client
  );

  // Keep the student's account active throughout payment preparation.
  const account = await client.query(
    `SELECT id
     FROM public.users
     WHERE id = $1
       AND role = 'student'
       AND account_status = 'active'
     FOR SHARE`,
    [studentId]
  );

  if (
    account.rows.length !== 1 ||
    String(account.rows[0].id) !== studentId
  ) {
    throw paymentError(
      "An active student account is required.",
      403
    );
  }

  // Lock the private booking.
  if (type === "one_on_one") {
    const booking = await lockBooking(
      id,
      studentId,
      client
    );

    // Register the successfully locked private booking.
    registerLockedPaymentSource(
      type,
      id,
      studentId,
      client
    );

    return {
      paymentType: type,
      studentId,
      booking,
      enrollment: null,
      groupClass: null,
    };
  }

  // Lock the group class and its enrollment.
  const {
    groupClass,
    enrollment,
  } = await lockGroupEnrollment(
    id,
    studentId,
    client
  );

  // Register the successfully locked group enrollment.
  registerLockedPaymentSource(
    type,
    id,
    studentId,
    client
  );

  return {
    paymentType: type,
    studentId,
    booking: null,
    enrollment,
    groupClass,
  };
}

// Find an existing active payment for a locked payment source.
async function findActivePayment(
  paymentType,
  sourceId,
  studentId,
  client
) {
  // Ensure the authorized payment source was locked first.
  requireLockedPaymentSource(
    paymentType,
    sourceId,
    studentId,
    client
  );

  const type = validatePaymentType(paymentType);

  const id = validateId(
    sourceId,
    "payment source ID"
  );

  const ownerId = validateId(
    studentId,
    "student ID"
  );

  // Select the appropriate database column.
  // This value comes from a validated payment type.
  const sourceColumn =
    type === "one_on_one"
      ? "booking_id"
      : "enrollment_id";

  // Check for an active payment and lock its record.
  const result = await client.query(
    `SELECT p.*
     FROM public.payments p
     WHERE p.${sourceColumn} = $1
       AND p.payment_type = $2
       AND p.livemode = $3
       AND p.payment_status = ANY($4::varchar[])
     FOR UPDATE OF p`,
    [
      id,
      type,
      LIVEMODE,
      ACTIVE_PAYMENT_STATUSES,
    ]
  );

  // Multiple active payments indicate a database inconsistency.
  if (result.rows.length > 1) {
    throw paymentError(
      "Multiple active payments detected.",
      500
    );
  }

  const payment = result.rows[0];

  // No active payment currently exists.
  if (!payment) {
    return null;
  }

  // Verify payment ownership before returning it.
  if (String(payment.student_id) !== ownerId) {
    throw paymentError(
      "Payment ownership mismatch."
    );
  }

  return payment;
}

// Check previous payment attempts before allowing a new attempt.
async function inspectPaymentHistory(
  paymentType,
  sourceId,
  studentId,
  client
) {
  // Ensure the authorized payment source was locked first.
  requireLockedPaymentSource(
    paymentType,
    sourceId,
    studentId,
    client
  );

  const type = validatePaymentType(paymentType);

  const id = validateId(
    sourceId,
    "payment source ID"
  );

  const ownerId = validateId(
    studentId,
    "student ID"
  );

  // Select the payment source using a validated payment type.
  const sourceColumn =
    type === "one_on_one"
      ? "booking_id"
      : "enrollment_id";

  // Identify previous payment statuses requiring reconciliation.
  const historicalStatuses = [
    "failed",
    "cancelled",
    "expired",
    "refunded",
  ];

  // Retrieve and lock all previous sandbox payment attempts.
  const result = await client.query(
    `SELECT p.*
     FROM public.payments p
     WHERE p.${sourceColumn} = $1
       AND p.payment_type = $2
       AND p.livemode = $3
     ORDER BY p.created_at DESC, p.id DESC
     FOR UPDATE OF p`,
    [id, type, LIVEMODE]
  );

  const payments = result.rows;

  // Validate ownership, source references and payment status.
  for (const payment of payments) {
    if (String(payment.student_id) !== ownerId) {
      throw paymentError(
        "Payment ownership mismatch."
      );
    }

    if (
      payment.payment_type !== type ||
      payment.livemode !== LIVEMODE ||
      String(payment[sourceColumn]) !== id
    ) {
      throw paymentError(
        "Payment history source mismatch.",
        500
      );
    }

    // Each payment must belong to exactly one tutoring source.
    if (
      (
        type === "one_on_one" &&
        payment.enrollment_id !== null
      ) ||
      (
        type === "group" &&
        payment.booking_id !== null
      )
    ) {
      throw paymentError(
        "Invalid payment history reference.",
        500
      );
    }

    // Reject unknown payment statuses before classifying history.
    if (
      !ACTIVE_PAYMENT_STATUSES.includes(
        payment.payment_status
      ) &&
      !historicalStatuses.includes(
        payment.payment_status
      )
    ) {
      throw paymentError(
        "Unknown payment history status.",
        500
      );
    }
  }

  // Identify payments that are still active.
  const activePayments = payments.filter(
    (payment) =>
      ACTIVE_PAYMENT_STATUSES.includes(
        payment.payment_status
      )
  );

  // Identify historical attempts requiring reconciliation.
  const historicalPayments = payments.filter(
    (payment) =>
      historicalStatuses.includes(
        payment.payment_status
      )
  );

  // Only one active payment is allowed per source.
  if (activePayments.length > 1) {
    throw paymentError(
      "Multiple active payments detected.",
      500
    );
  }

  const activePayment = activePayments[0] || null;

  // Prevent another payment when an existing payment
  // is processing, paid, partially refunded or disputed.
  if (
    activePayment &&
    activePayment.payment_status !== "pending"
  ) {
    return {
      action: "block",
      payment: activePayment,
      payments,
      historicalPayments,
    };
  }

  // Reconcile every historical attempt before creating
  // or reusing another payment.
  if (historicalPayments.length > 0) {
    return {
      action: "reconcile",
      payment: historicalPayments[0],
      payments,
      historicalPayments,
    };
  }

  // A single pending payment is a candidate for reuse.
  // Its source, pricing and Stripe state must still be verified.
  if (activePayment) {
    validateStoredIdempotencyKey(activePayment);

    return {
      action: "reuse",
      payment: activePayment,
      payments,
      historicalPayments: [],
    };
  }

  // Allow creation only when no previous payment exists.
  return {
    action: "create",
    payment: null,
    payments: [],
    historicalPayments: [],
  };
}

// Validate a stored idempotency key before reusing it.
function validateStoredIdempotencyKey(
  payment
) {
  // Make sure a valid payment record was provided.
  if (
    !payment ||
    typeof payment !== "object" ||
    Array.isArray(payment)
  ) {
    throw paymentError(
      "Invalid payment record.",
      400
    );
  }

  // Only sandbox payment keys are currently supported.
  if (payment.livemode !== LIVEMODE) {
    throw paymentError(
      "Invalid payment environment."
    );
  }

  const paymentType = validatePaymentType(
    payment.payment_type
  );

  // Verify that the payment has the correct source reference.
  if (
    paymentType === "one_on_one" &&
    (
      payment.booking_id == null ||
      payment.enrollment_id !== null
    )
  ) {
    throw paymentError(
      "Invalid private payment reference."
    );
  }

  if (
    paymentType === "group" &&
    (
      payment.enrollment_id == null ||
      payment.booking_id !== null
    )
  ) {
    throw paymentError(
      "Invalid group payment reference."
    );
  }

  // Identify the original tutoring payment source.
  const sourceId = validateId(
    paymentType === "one_on_one"
      ? payment.booking_id
      : payment.enrollment_id,
    "payment source ID"
  );

  const key = payment.idempotency_key;

  // Reject missing or invalid Stripe idempotency keys.
  if (
    typeof key !== "string" ||
    key.length === 0 ||
    key.length > 255
  ) {
    throw paymentError(
      "Invalid stored idempotency key."
    );
  }

  // Ensure the key belongs to this payment environment,
  // payment type and original tutoring source.
  const expectedPrefix = [
    "tulinkup",
    "sandbox",
    paymentType,
    sourceId,
    "",
  ].join("-");

  if (!key.startsWith(expectedPrefix)) {
    throw paymentError(
      "Idempotency key source mismatch."
    );
  }

  // Verify the UUID generated for the original attempt.
  const attemptId = key.slice(
    expectedPrefix.length
  );

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (
    attemptId.length !== 36 ||
    !uuidPattern.test(attemptId)
  ) {
    throw paymentError(
      "Invalid idempotency attempt identifier."
    );
  }

  // Return the original key without modifying it.
  return key;
}

module.exports = {
  ACTIVE_PAYMENT_STATUSES,
  PAYMENT_TYPES,
  LIVEMODE,
  validateId,
  validatePaymentType,
  generateIdempotencyKey,
  withPaymentTransaction,
  validateTransactionClient,
  lockBooking,
  lockGroupEnrollment,
  lockPaymentSource,
  findActivePayment,
  inspectPaymentHistory,
  validateStoredIdempotencyKey,
  requireLockedPaymentSource,
};
