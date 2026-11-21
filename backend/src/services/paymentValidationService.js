
const pool = require("../config/db");

const {
  PRICING,
  calculatePrivateSessionPrice,
  calculateRevenueSplit,
  validateGroupPricing,
} = require("../utils/pricing");

const {
  validatePaymentAmount,
} = require("../utils/paymentPricing");

// Create an error that the payment controller can handle.
function paymentError(message, statusCode = 409) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// Validate a database record ID.
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

  // Make sure the ID is a positive PostgreSQL BIGINT.
  if (
    !/^[1-9]\d{0,18}$/.test(id) ||
    BigInt(id) > 9223372036854775807n
  ) {
    throw paymentError(`Invalid ${name}.`, 400);
  }

  return id;
}

// Verify the authenticated student's database account.
async function authorizeStudent(user, db = pool) {
  if (!user?.userId) {
    throw paymentError("Authentication required.", 401);
  }

  if (user.role !== "student") {
    throw paymentError(
      "Only students can make tutoring payments.",
      403
    );
  }

  const studentId = validateId(
    user.userId,
    "student ID"
  );

  const result = await db.query(
    `SELECT id, role
     FROM public.users
     WHERE id = $1
       AND role = 'student'
     LIMIT 1`,
    [studentId]
  );

  if (!result.rows.length) {
    throw paymentError(
      "A valid student account is required.",
      403
    );
  }

  return String(result.rows[0].id);
}

// Check the tutor's stored Stripe account readiness.
async function validateTutorPaymentAccount(
  tutorId,
  db = pool
) {
  const id = validateId(tutorId, "tutor ID");

  const result = await db.query(
    `SELECT
       a.id,
       a.tutor_id,
       a.stripe_account_id,
       a.details_submitted,
       a.payouts_enabled,
       a.transfers_enabled,
       a.onboarding_completed,
       a.livemode
     FROM public.tutor_stripe_accounts a
     JOIN public.users u
       ON u.id = a.tutor_id
     WHERE a.tutor_id = $1
       AND u.role = 'tutor'
       AND a.livemode = FALSE
     LIMIT 1`,
    [id]
  );

  const account = result.rows[0];

  if (
    !account ||
    account.details_submitted !== true ||
    account.onboarding_completed !== true ||
    account.transfers_enabled !== true ||
    account.payouts_enabled !== true ||
    account.livemode !== false ||
    !/^acct_[a-zA-Z0-9]+$/.test(
      account.stripe_account_id
    )
  ) {
    throw paymentError(
      "This tutor has not completed payment account setup."
    );
  }

  return account;
}

// Verify stored pricing and revenue distribution.
function validateRevenueSnapshot({
  amountCents,
  platformCommissionCents,
  tutorEarningsCents,
  currency,
  paymentType,
}) {
  if (currency !== PRICING.CURRENCY) {
    throw paymentError(
      "Unsupported payment currency."
    );
  }

  validatePaymentAmount(
    amountCents,
    paymentType
  );

  const revenue = calculateRevenueSplit(
    amountCents
  );

  if (
    platformCommissionCents !==
      revenue.platformCommissionCents ||
    tutorEarningsCents !==
      revenue.tutorEarningsCents
  ) {
    throw paymentError(
      "The stored payment distribution is invalid."
    );
  }

  return revenue;
}

// Verify that a private booking is eligible for payment.
async function validateBookingPayment(
  bookingId,
  studentId,
  db = pool
) {
  const id = validateId(bookingId, "booking ID");

  const ownerId = validateId(
    studentId,
    "student ID"
  );

  const result = await db.query(
    `SELECT
       b.*,
       (
         (b.booking_date + b.booking_time)
         AT TIME ZONE 'America/Toronto'
       ) > NOW() AS is_future
     FROM public.bookings b
     JOIN public.users u
       ON u.id = b.student_id
       AND u.role = 'student'
     WHERE b.id = $1
       AND b.student_id = $2
     LIMIT 1`,
    [id, ownerId]
  );

  const booking = result.rows[0];

  if (!booking) {
    throw paymentError("Booking not found.", 404);
  }

  if (booking.status !== "pending") {
    throw paymentError(
      "This booking is not eligible for payment."
    );
  }

  if (booking.is_future !== true) {
    throw paymentError(
      "Past bookings cannot receive new payments."
    );
  }

  if (booking.total_price_cents === 0) {
    throw paymentError(
      "Free bookings do not require payment."
    );
  }

  if (
    !["unpaid", "pending"].includes(
      booking.payment_status
    )
  ) {
    throw paymentError(
      "This booking cannot start a new payment."
    );
  }

  if (
    String(booking.student_id) ===
      String(booking.tutor_id)
  ) {
    throw paymentError(
      "Students cannot pay themselves."
    );
  }

  if (
    !Number.isSafeInteger(
      booking.hourly_rate_cents
    ) ||
    booking.hourly_rate_cents <= 0 ||
    booking.hourly_rate_cents >
      PRICING.MAX_PRIVATE_HOURLY_RATE_CENTS
  ) {
    throw paymentError(
      "Invalid stored hourly rate."
    );
  }

  if (
    ![30, 60, 90].includes(
      booking.duration_minutes
    )
  ) {
    throw paymentError(
      "Invalid stored session duration."
    );
  }

  const expectedPrice =
    calculatePrivateSessionPrice(
      booking.hourly_rate_cents,
      booking.duration_minutes
    );

  if (
    booking.total_price_cents !== expectedPrice
  ) {
    throw paymentError(
      "The stored booking price is invalid."
    );
  }

  validateRevenueSnapshot({
    amountCents: booking.total_price_cents,
    platformCommissionCents:
      booking.platform_commission_cents,
    tutorEarningsCents:
      booking.tutor_earnings_cents,
    currency: booking.currency,
    paymentType: "one_on_one",
  });

  await validateTutorPaymentAccount(
    booking.tutor_id,
    db
  );

  // Return trusted payment information from the database.
  return {
    student_id: String(booking.student_id),
    tutor_id: String(booking.tutor_id),
    payment_type: "one_on_one",
    booking_id: String(booking.id),
    enrollment_id: null,
    amount_cents: booking.total_price_cents,
    platform_commission_cents:
      booking.platform_commission_cents,
    tutor_earnings_cents:
      booking.tutor_earnings_cents,
    currency: booking.currency,
    livemode: false,
  };
}

// Verify that a group enrolment is eligible for payment.
async function validateGroupPayment(
  enrollmentId,
  studentId,
  db = pool
) {
  const id = validateId(
    enrollmentId,
    "enrollment ID"
  );

  const ownerId = validateId(
    studentId,
    "student ID"
  );

  const result = await db.query(
    `SELECT
       e.*,
       c.tutor_id,
       c.status AS class_status,
       c.price_cents AS class_price_cents,
       c.currency AS class_currency,
       c.minimum_students,
       c.maximum_students,
       c.scheduled_at > NOW() AS is_future
     FROM public.group_class_enrollments e
     JOIN public.group_classes c
       ON c.id = e.class_id
     JOIN public.users u
       ON u.id = e.student_id
       AND u.role = 'student'
     WHERE e.id = $1
       AND e.student_id = $2
     LIMIT 1`,
    [id, ownerId]
  );

  const enrollment = result.rows[0];

  if (!enrollment) {
    throw paymentError(
      "Group enrollment not found.",
      404
    );
  }

  if (
    enrollment.class_status !== "published" ||
    enrollment.is_future !== true
  ) {
    throw paymentError(
      "This group class is not accepting payments."
    );
  }

  if (
    enrollment.enrollment_status !== "pending"
  ) {
    throw paymentError(
      "This enrollment is not eligible for payment."
    );
  }

  if (enrollment.price_cents === 0) {
    throw paymentError(
      "Free group classes do not require payment."
    );
  }

  if (
    !["unpaid", "pending"].includes(
      enrollment.payment_status
    ) ||
    enrollment.amount_paid_cents !== 0
  ) {
    throw paymentError(
      "This enrollment cannot start a new payment."
    );
  }

  if (
    String(enrollment.student_id) ===
      String(enrollment.tutor_id)
  ) {
    throw paymentError(
      "Students cannot pay themselves."
    );
  }

  if (
    enrollment.currency !== PRICING.CURRENCY ||
    enrollment.class_currency !== PRICING.CURRENCY
  ) {
    throw paymentError(
      "Invalid group class currency."
    );
  }

  // Verify the class's stored pricing and capacity.
  validateGroupPricing(
    enrollment.class_price_cents,
    enrollment.minimum_students,
    enrollment.maximum_students,
    PRICING
  );

  validateRevenueSnapshot({
    amountCents: enrollment.price_cents,
    platformCommissionCents:
      enrollment.platform_commission_cents,
    tutorEarningsCents:
      enrollment.tutor_earnings_cents,
    currency: enrollment.currency,
    paymentType: "group",
  });

  // Reject changed prices until the enrollment is reconciled.
  if (
    enrollment.price_cents !==
      enrollment.class_price_cents
  ) {
    throw paymentError(
      "The class price does not match the enrollment."
    );
  }

  // Count occupied seats, including pending enrollments.
  const capacity = await db.query(
    `SELECT COUNT(*)::integer AS occupied
     FROM public.group_class_enrollments
     WHERE class_id = $1
       AND id <> $2
       AND enrollment_status IN (
         'pending',
         'confirmed',
         'attended',
         'absent'
       )`,
    [enrollment.class_id, enrollment.id]
  );

  const occupied = capacity.rows[0].occupied;

  if (occupied >= enrollment.maximum_students) {
    throw paymentError(
      "This group class has reached its capacity."
    );
  }

  await validateTutorPaymentAccount(
    enrollment.tutor_id,
    db
  );

  return {
    student_id: String(enrollment.student_id),
    tutor_id: String(enrollment.tutor_id),
    payment_type: "group",
    booking_id: null,
    enrollment_id: String(enrollment.id),
    amount_cents: enrollment.price_cents,
    platform_commission_cents:
      enrollment.platform_commission_cents,
    tutor_earnings_cents:
      enrollment.tutor_earnings_cents,
    currency: enrollment.currency,
    livemode: false,
  };
}

// Verify that a stored payment matches its original tutoring source.
async function validatePaymentSource(
  payment,
  user,
  db = pool
) {
  // Verify the authenticated student's account.
  const studentId = await authorizeStudent(user, db);

  // Make sure a valid payment record was provided.
  if (
    !payment ||
    typeof payment !== "object" ||
    Array.isArray(payment)
  ) {
    throw paymentError("Invalid payment record.", 400);
  }

  // Validate the payment and participant database IDs.
  validateId(payment.id, "payment ID");

  const paymentStudentId = validateId(
    payment.student_id,
    "payment student ID"
  );

  validateId(payment.tutor_id, "payment tutor ID");

  // Protect payments belonging to other students.
  if (paymentStudentId !== studentId) {
    throw paymentError("Payment not found.", 404);
  }

  // Only pending payments can initiate Checkout.
  if (payment.payment_status !== "pending") {
    throw paymentError(
      "This payment is not eligible for Checkout."
    );
  }

  // Only sandbox payments are currently supported.
  if (payment.livemode !== false) {
    throw paymentError(
      "Live payments are currently unavailable."
    );
  }

  let source;

  // Load and validate the original private booking.
  if (payment.payment_type === "one_on_one") {
    if (
      payment.booking_id == null ||
      payment.enrollment_id !== null
    ) {
      throw paymentError(
        "Invalid private payment reference."
      );
    }

    source = await validateBookingPayment(
      payment.booking_id,
      studentId,
      db
    );

  // Load and validate the original group enrollment.
  } else if (payment.payment_type === "group") {
    if (
      payment.enrollment_id == null ||
      payment.booking_id !== null
    ) {
      throw paymentError(
        "Invalid group payment reference."
      );
    }

    source = await validateGroupPayment(
      payment.enrollment_id,
      studentId,
      db
    );

  } else {
    throw paymentError("Invalid payment type.");
  }

  // Compare the stored IDs against the original source.
  const idFields = [
    "student_id",
    "tutor_id",
    "booking_id",
    "enrollment_id",
  ];

  for (const field of idFields) {
    const storedId =
      payment[field] === null
        ? null
        : validateId(payment[field], field);

    if (storedId !== source[field]) {
      throw paymentError(
        `Payment source mismatch: ${field}.`
      );
    }
  }

  // Compare the stored financial and payment information.
  const paymentFields = [
    "payment_type",
    "amount_cents",
    "platform_commission_cents",
    "tutor_earnings_cents",
    "currency",
    "livemode",
  ];

  for (const field of paymentFields) {
    if (payment[field] !== source[field]) {
      throw paymentError(
        `Payment source mismatch: ${field}.`
      );
    }
  }

  // Return the trusted information from the original source.
  return source;
}

module.exports = {
  authorizeStudent,
  validateTutorPaymentAccount,
  validateRevenueSnapshot,
  validateBookingPayment,
  validateGroupPayment,
  validatePaymentSource,
};
