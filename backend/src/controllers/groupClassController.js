const pool = require("../config/db");

const {
  validateTutorId,
  lockEligibleTutor,
} = require("../services/tutorEligibilityService");

const {
  beginBookingTransaction,
  lockActiveBookingUser,
  commitBookingTransaction,
  rollbackBookingTransaction,
  abortBookingTransaction,
  releaseBookingTransaction,
} = require("../services/bookingTransactionService");

// Import shared scheduling conflict validation.
const {
  lockTutorSchedule,
  hasGroupClassConflict,
  hasBookingConflict,
} = require("../utils/schedulingConflict");

// Import shared pricing rules.
const {
  getPricingConfig,
  getMaximumGroupStudents,
  validateGroupPricing,
  calculateRevenueSplit,
  getInitialPaymentStatus,
} = require("../utils/pricing");

// Return an error response.
function fail(res, status, message) {
  return res.status(status).json({
    success: false,
    message,
  });
}

// Check whether a class ID is valid.
function validId(id) {
  try {
    validateTutorId(id);
    return true;
  } catch {
    return false;
  }
}

// Return a safe response when a class transaction fails.
function groupTransactionError(res, error, message) {
  res.set("Cache-Control", "no-store");

  if (error.code === "BOOKING_COMMIT_UNCERTAIN") {
    return res.status(503).json({
      success: false,
      code: "GROUP_CLASS_COMMIT_UNCERTAIN",
      message: "The operation outcome requires verification. Refresh before trying again.",
    });
  }

  if (error.code === "BOOKING_ROLLBACK_FAILED") {
    return fail(
      res,
      503,
      "The class operation could not be safely completed."
    );
  }

  if (["55P03", "57014", "40P01"].includes(error.code)) {
    return fail(
      res,
      503,
      "The class service is temporarily busy. Please try again."
    );
  }

  if (error.statusCode === 403) {
    return fail(res, 403, "An active account is required.");
  }

  if (error.statusCode === 400) {
    return fail(res, 400, "Invalid class information.");
  }

  if (error.statusCode === 409) {
    return fail(
      res,
      409,
      "This tutor is not currently eligible to offer tutoring services."
    );
  }

  console.error("Group class transaction failed.");
  return fail(res, 500, message);
}

// Validate class information.
function validateClass(body, pricing) {
  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();
  const subject = String(body.subject || "").trim();
  const educationLevel = String(body.educationLevel || "").trim();

  const scheduledAt = new Date(body.scheduledAt);
  const durationMinutes = Number(body.durationMinutes ?? 60);

  // Keep the default price within the current platform limits.
  const defaultPrice = Math.min(
    pricing.MAX_GROUP_PRICE_CENTS,
    Math.max(
      pricing.MIN_GROUP_PRICE_CENTS,
      Math.min(
        500,
        Math.floor(
          pricing.MAX_GROUP_REVENUE_CENTS /
            pricing.MIN_GROUP_CAPACITY
        )
      )
    )
  );

  const priceCents = Number(body.priceCents ?? defaultPrice);
  const minimumStudents = Number(body.minimumStudents ?? 1);

  const maximumStudents = Number(
    body.maximumStudents ??
      getMaximumGroupStudents(priceCents, pricing)
  );

  if (!title || title.length > 150) {
    throw new Error("Enter a valid class title.");
  }

  if (!description || description.length > 5000) {
    throw new Error("Enter a valid class description.");
  }

  if (!subject || subject.length > 100) {
    throw new Error("Enter a valid subject.");
  }

  if (!educationLevel || educationLevel.length > 100) {
    throw new Error("Enter a valid education level.");
  }

  if (
    !Number.isFinite(scheduledAt.getTime()) ||
    scheduledAt <= new Date()
  ) {
    throw new Error("Select a future class date and time.");
  }

  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 15 ||
    durationMinutes > 180
  ) {
    throw new Error("Duration must be between 15 and 180 minutes.");
  }

  // Check the price and capacity against the platform rules.
  validateGroupPricing(
    priceCents,
    minimumStudents,
    maximumStudents,
    pricing
  );

  return [
    title,
    description,
    subject,
    educationLevel,
    scheduledAt.toISOString(),
    durationMinutes,
    priceCents,
    minimumStudents,
    maximumStudents,
  ];
}

// Shared query for class information.
const classSelect = `
  SELECT
    gc.*,
    u.full_name AS tutor_name,
    (
      SELECT COUNT(*)::INTEGER
      FROM public.group_class_enrollments e
      WHERE e.class_id = gc.id
      AND e.enrollment_status IN (
        'pending', 'confirmed', 'attended', 'absent'
      )
    ) AS enrolled_students
  FROM public.group_classes gc
  JOIN public.users u ON u.id = gc.tutor_id
`;

// Only show public classes offered by eligible tutors.
const publicTutorEligibility = `
  AND u.role = 'tutor'
  AND u.account_status = 'active'
  AND EXISTS (
    SELECT 1
    FROM public.tutor_profiles tp
    WHERE tp.user_id = gc.tutor_id
      AND tp.approval_status = 'approved'
  )
`;

// Browse published group classes.
async function getGroupClasses(req, res) {
  res.set("Cache-Control", "no-store");

  try {
    const result = await pool.query(`
      ${classSelect}
      WHERE gc.status = 'published'
      AND gc.scheduled_at > NOW()
      ${publicTutorEligibility}
      ORDER BY gc.scheduled_at ASC
      LIMIT 100
    `);

    res.json({
      success: true,
      classes: result.rows,
    });
  } catch (error) {
    console.error("Get group classes error:", error.message);
    return fail(res, 500, "Unable to load group classes.");
  }
}

// View a published or active live class.
async function getGroupClassById(req, res) {
  res.set("Cache-Control", "no-store");

  try {
    const { id } = req.params;

    if (!validId(id)) {
      return fail(res, 400, "Invalid class ID.");
    }

    const result = await pool.query(
      `
        ${classSelect}
        WHERE gc.id = $1
        AND gc.status IN ('published', 'live')
        ${publicTutorEligibility}
      `,
      [id]
    );

    if (!result.rows.length) {
      return fail(res, 404, "Group class not found.");
    }

    res.json({
      success: true,
      groupClass: result.rows[0],
    });
  } catch (error) {
    console.error("Get group class error:", error.message);
    return fail(res, 500, "Unable to load group class.");
  }
}

// Get classes belonging to the signed-in tutor.
async function getMyGroupClasses(req, res) {
  try {
    if (req.user.role !== "tutor") {
      return fail(res, 403, "Only tutors can manage classes.");
    }

    const result = await pool.query(
      `
        ${classSelect}
        WHERE gc.tutor_id = $1
        ORDER BY gc.scheduled_at DESC
      `,
      [req.user.userId]
    );

    res.json({
      success: true,
      classes: result.rows,
    });
  } catch (error) {
    console.error("Get tutor classes error:", error.message);
    return fail(res, 500, "Unable to load your classes.");
  }
}

// Create a group class as a draft.
async function createGroupClass(req, res) {
  res.set("Cache-Control", "no-store");
  if (req.user.role !== "tutor") {
    return fail(res, 403, "Only tutors can create group classes.");
  }

  let client;

  try {
    client = await beginBookingTransaction();

    // Make sure the account is still active.
    await lockActiveBookingUser(
      client,
      req.user.userId,
      "tutor"
    );

    // Retrieve the current platform pricing configuration.
    const pricing = await getPricingConfig(client);

    let values;

    try {
      values = validateClass(req.body || {}, pricing);
    } catch (error) {
      await rollbackBookingTransaction(client);
      return fail(res, 400, error.message);
    }

    const tutor = await client.query(
      `
        SELECT tp.user_id
        FROM public.tutor_profiles tp
        JOIN public.users u ON u.id = tp.user_id
        WHERE tp.user_id = $1
        AND u.role = 'tutor'
      `,
      [req.user.userId]
    );

    if (!tutor.rows.length) {
      await rollbackBookingTransaction(client);
      return fail(res, 403, "Complete your tutor profile first.");
    }

    const result = await client.query(
      `
        INSERT INTO public.group_classes (
          tutor_id,
          title,
          description,
          subject,
          education_level,
          scheduled_at,
          duration_minutes,
          price_cents,
          minimum_students,
          maximum_students
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10
        )
        RETURNING *
      `,
      [req.user.userId, ...values]
    );

    // Verify the database write before committing.
    if (
      result.command !== "INSERT" ||
      result.rowCount !== 1 ||
      result.rows.length !== 1
    ) {
      throw new Error("Unexpected class write result.");
    }

    await commitBookingTransaction(client);

    res.status(201).json({
      success: true,
      message: "Group class created successfully.",
      groupClass: result.rows[0],
    });
  } catch (error) {
    if (client) {
      try {
        await abortBookingTransaction(client);
      } catch (rollbackError) {
        error = rollbackError;
      }
    }

    return groupTransactionError(
      res,
      error,
      "Unable to create group class."
    );
  } finally {
    if (client) {
      releaseBookingTransaction(client);
    }
  }
}

// Edit a tutor's draft class.
async function updateGroupClass(req, res) {
  res.set("Cache-Control", "no-store");
  if (req.user.role !== "tutor") {
    return fail(res, 403, "Only tutors can edit group classes.");
  }

  const { id } = req.params;

  if (!validId(id)) {
    return fail(res, 400, "Invalid class ID.");
  }

  let client;

  try {
    client = await beginBookingTransaction();

    // Make sure the account is still active.
    await lockActiveBookingUser(
      client,
      req.user.userId,
      "tutor"
    );

    // Retrieve the current platform pricing configuration.
    const pricing = await getPricingConfig(client);

    let values;

    try {
      values = validateClass(req.body || {}, pricing);
    } catch (error) {
      await rollbackBookingTransaction(client);
      return fail(res, 400, error.message);
    }

    const result = await client.query(
      `
        UPDATE public.group_classes
        SET
          title = $1,
          description = $2,
          subject = $3,
          education_level = $4,
          scheduled_at = $5,
          duration_minutes = $6,
          price_cents = $7,
          minimum_students = $8,
          maximum_students = $9,
          updated_at = NOW()
        WHERE id = $10
        AND tutor_id = $11
        AND status = 'draft'
        RETURNING *
      `,
      [...values, id, req.user.userId]
    );

    if (!result.rows.length) {
      await rollbackBookingTransaction(client);
      return fail(res, 404, "Editable draft class not found.");
    }

    // Verify the database write before committing.
    if (
      result.command !== "UPDATE" ||
      result.rowCount !== 1 ||
      result.rows.length !== 1
    ) {
      throw new Error("Unexpected class write result.");
    }

    await commitBookingTransaction(client);

    res.json({
      success: true,
      message: "Group class updated successfully.",
      groupClass: result.rows[0],
    });
  } catch (error) {
    if (client) {
      try {
        await abortBookingTransaction(client);
      } catch (rollbackError) {
        error = rollbackError;
      }
    }

    return groupTransactionError(
      res,
      error,
      "Unable to update group class."
    );
  } finally {
    if (client) {
      releaseBookingTransaction(client);
    }
  }
}

// Publish a draft class or cancel a class.
async function updateGroupClassStatus(req, res) {
  res.set("Cache-Control", "no-store");
  if (req.user.role !== "tutor") {
    return fail(res, 403, "Only tutors can manage class status.");
  }

  const { id } = req.params;
  const { status } = req.body || {};

  if (!validId(id)) {
    return fail(res, 400, "Invalid class ID.");
  }

  if (!["published", "cancelled"].includes(status)) {
    return fail(res, 400, "Invalid class status.");
  }

  let client;

  try {
    client = await beginBookingTransaction();

    // Make sure the account is still active.
    await lockActiveBookingUser(
      client,
      req.user.userId,
      "tutor"
    );

    // Lock the tutor's schedule before checking for conflicts.
    await lockTutorSchedule(client, req.user.userId);

    const result = await client.query(
      `
        SELECT *
        FROM public.group_classes
        WHERE id = $1 AND tutor_id = $2
        FOR UPDATE
      `,
      [id, req.user.userId]
    );

    const groupClass = result.rows[0];

    if (!groupClass) {
      await rollbackBookingTransaction(client);
      return fail(res, 404, "Group class not found.");
    }

    if (status === "published") {
      // Only approved tutors can publish classes.
      await lockEligibleTutor(req.user.userId, client);
      // Only future draft classes can be published.
      if (
        groupClass.status !== "draft" ||
        new Date(groupClass.scheduled_at) <= new Date()
      ) {
        await rollbackBookingTransaction(client);
        return fail(res, 409, "This class cannot be published.");
      }

      // Retrieve the latest platform pricing rules.
      const pricing = await getPricingConfig(client);

      // Check pricing again before publishing the class.
      try {
        validateGroupPricing(
          Number(groupClass.price_cents),
          Number(groupClass.minimum_students),
          Number(groupClass.maximum_students),
          pricing
        );

        if (groupClass.currency !== pricing.CURRENCY) {
          throw new Error("Invalid group class currency.");
        }
      } catch (error) {
        await rollbackBookingTransaction(client);
        return fail(res, 400, error.message);
      }

      // Check for overlapping published or live group classes.
      const groupConflict = await hasGroupClassConflict(
        client,
        req.user.userId,
        groupClass.scheduled_at,
        groupClass.duration_minutes,
        id
      );

      // Prevent publishing overlapping group classes.
      if (groupConflict) {
        await rollbackBookingTransaction(client);

        return fail(
          res,
          409,
          "You already have a group class scheduled at this time."
        );
      }

      // Check for overlapping one-on-one tutoring sessions.
      const bookingConflict = await hasBookingConflict(
        client,
        req.user.userId,
        groupClass.scheduled_at,
        groupClass.duration_minutes
      );

      // Prevent conflicts with existing tutoring bookings.
      if (bookingConflict) {
        await rollbackBookingTransaction(client);

        return fail(
          res,
          409,
          "This group class overlaps with an existing tutoring booking."
        );
      }
    }

    if (status === "cancelled") {
      if (!["draft", "published"].includes(groupClass.status)) {
        await rollbackBookingTransaction(client);
        return fail(res, 409, "This class cannot be cancelled.");
      }

      const payments = await client.query(
        `
          SELECT id
          FROM public.group_class_enrollments
          WHERE class_id = $1
          AND (
            payment_status IN ('paid', 'pending')
            OR amount_paid_cents > 0
          )
          LIMIT 1
        `,
        [id]
      );

      if (payments.rows.length) {
        await rollbackBookingTransaction(client);
        return fail(res, 409, "Payment review is required.");
      }

      await client.query(
        `
          UPDATE public.group_class_enrollments
          SET
            enrollment_status = 'cancelled',
            updated_at = NOW()
          WHERE class_id = $1
          AND enrollment_status IN ('pending', 'confirmed')
        `,
        [id]
      );
    }

    const updated = await client.query(
      `
        UPDATE public.group_classes
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `,
      [status, id]
    );

    // Verify the database write before committing.
    if (
      updated.command !== "UPDATE" ||
      updated.rowCount !== 1 ||
      updated.rows.length !== 1 ||
      String(updated.rows[0].id) !== String(id) ||
      updated.rows[0].status !== status
    ) {
      throw new Error("Unexpected class write result.");
    }

    await commitBookingTransaction(client);

    res.json({
      success: true,
      message: `Group class ${status} successfully.`,
      groupClass: updated.rows[0],
    });
  } catch (error) {
    if (client) {
      try {
        await abortBookingTransaction(client);
      } catch (rollbackError) {
        error = rollbackError;
      }
    }

    return groupTransactionError(
      res,
      error,
      "Unable to update class status."
    );
  } finally {
    if (client) {
      releaseBookingTransaction(client);
    }
  }
}

// Enrol a student in a free group class.
async function enrollInGroupClass(req, res) {
  res.set("Cache-Control", "no-store");
  if (req.user.role !== "student") {
    return fail(res, 403, "Only students can enrol.");
  }

  const { id } = req.params;

  if (!validId(id)) {
    return fail(res, 400, "Invalid class ID.");
  }

  let client;

  try {
    client = await beginBookingTransaction();

    // Make sure the account is still active.
    await lockActiveBookingUser(
      client,
      req.user.userId,
      "student"
    );

    // Lock the class to prevent simultaneous overbooking.
    const classResult = await client.query(
      `
        SELECT *
        FROM public.group_classes
        WHERE id = $1
        FOR UPDATE
      `,
      [id]
    );

    const groupClass = classResult.rows[0];

    if (!groupClass) {
      await rollbackBookingTransaction(client);
      return fail(res, 404, "Group class not found.");
    }

    if (
      groupClass.status !== "published" ||
      new Date(groupClass.scheduled_at) <= new Date()
    ) {
      await rollbackBookingTransaction(client);
      return fail(res, 409, "This class is not open for enrolment.");
    }

    // Make sure the tutor is still eligible to offer this class.
    await lockEligibleTutor(groupClass.tutor_id, client);

    // Retrieve the current platform pricing configuration.
    const pricing = await getPricingConfig(client);

    // Use the price stored in the database.
    const priceCents = Number(groupClass.price_cents);

    let paymentStatus;
    let revenue;

    try {
      validateGroupPricing(
        priceCents,
        Number(groupClass.minimum_students),
        Number(groupClass.maximum_students),
        pricing
      );

      if (groupClass.currency !== pricing.CURRENCY) {
        throw new Error("Invalid group class currency.");
      }

      // Determine whether enrolment is permitted.
      paymentStatus = getInitialPaymentStatus(
        priceCents,
        pricing
      );

      // Calculate the commission and tutor earnings.
      revenue = calculateRevenueSplit(
        priceCents,
        pricing
      );
    } catch (error) {
      await rollbackBookingTransaction(client);
      return fail(res, 409, error.message);
    }

    // Paid enrolments require verified payment integration.
    if (priceCents > 0) {
      await rollbackBookingTransaction(client);

      return fail(
        res,
        409,
        "Payments are not available yet. Please select a free class."
      );
    }

    // Check whether the student already has an enrolment.
    const existing = await client.query(
      `
        SELECT *
        FROM public.group_class_enrollments
        WHERE class_id = $1 AND student_id = $2
        FOR UPDATE
      `,
      [id, req.user.userId]
    );

    const existingEnrollment = existing.rows[0];

    // Prevent duplicate active enrolments.
    if (
      existingEnrollment &&
      existingEnrollment.enrollment_status !== "cancelled"
    ) {
      await rollbackBookingTransaction(client);

      return fail(res, 409, "An enrolment already exists.");
    }

    // Prevent reactivating enrolments that require payment review.
    if (
      existingEnrollment &&
      (
        Number(existingEnrollment.amount_paid_cents) > 0 ||
        !["not_required", "unpaid", "failed"].includes(
          existingEnrollment.payment_status
        )
      )
    ) {
      await rollbackBookingTransaction(client);

      return fail(res, 409, "Payment review is required.");
    }

    // Count active enrolments without including cancelled ones.
    const countResult = await client.query(
      `
        SELECT COUNT(*)::INTEGER AS total
        FROM public.group_class_enrollments
        WHERE class_id = $1
        AND enrollment_status IN (
          'pending', 'confirmed', 'attended', 'absent'
        )
      `,
      [id]
    );

    const enrolledStudents = countResult.rows[0].total;

    // Prevent new enrolment or re-enrolment when the class is full.
    if (enrolledStudents >= groupClass.maximum_students) {
      await rollbackBookingTransaction(client);
      return fail(res, 409, "This group class is full.");
    }

    let result;

    if (existingEnrollment) {
      // Reactivate the cancelled enrolment with its current pricing.
      result = await client.query(
        `
          UPDATE public.group_class_enrollments
          SET
            enrollment_status = 'confirmed',
            payment_status = $6,
            amount_paid_cents = 0,
            price_cents = $2,
            platform_commission_cents = $3,
            tutor_earnings_cents = $4,
            currency = $5,
            enrolled_at = NOW(),
            updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `,
        [
          existingEnrollment.id,
          priceCents,
          revenue.platformCommissionCents,
          revenue.tutorEarningsCents,
          revenue.currency,
          paymentStatus,
        ]
      );
    } else {
      // Store the agreed price and revenue split for the enrolment.
      result = await client.query(
        `
          INSERT INTO public.group_class_enrollments (
            class_id,
            student_id,
            amount_paid_cents,
            payment_status,
            enrollment_status,
            price_cents,
            platform_commission_cents,
            tutor_earnings_cents,
            currency
          )
          VALUES (
            $1,
            $2,
            0,
            $7,
            'confirmed',
            $3,
            $4,
            $5,
            $6
          )
          RETURNING *
        `,
        [
          id,
          req.user.userId,
          priceCents,
          revenue.platformCommissionCents,
          revenue.tutorEarningsCents,
          revenue.currency,
          paymentStatus,
        ]
      );
    }

    // Verify the database write before committing.
    if (
      result.command !== (existingEnrollment ? "UPDATE" : "INSERT") ||
      result.rowCount !== 1 ||
      result.rows.length !== 1 ||
      result.rows[0].enrollment_status !== "confirmed"
    ) {
      throw new Error("Unexpected class write result.");
    }

    await commitBookingTransaction(client);

    res.status(existingEnrollment ? 200 : 201).json({
      success: true,
      message: existingEnrollment
        ? "You have successfully re-enrolled."
        : "You have successfully enrolled.",
      enrollment: result.rows[0],
    });
  } catch (error) {
    if (client) {
      try {
        await abortBookingTransaction(client);
      } catch (rollbackError) {
        error = rollbackError;
      }
    }

    if (error.code === "23505") {
      return fail(res, 409, "An enrolment already exists.");
    }

    return groupTransactionError(
      res,
      error,
      "Unable to enrol in this class."
    );
  } finally {
    if (client) {
      releaseBookingTransaction(client);
    }
  }
}

// Allow a student to cancel their group class enrolment.
async function cancelEnrollment(req, res) {
  res.set("Cache-Control", "no-store");
  // Only students can cancel their own enrolments.
  if (req.user.role !== "student") {
    return fail(res, 403, "Only students can cancel enrolments.");
  }

  const { id } = req.params;

  // Validate the group class ID.
  if (!validId(id)) {
    return fail(res, 400, "Invalid class ID.");
  }

  let client;

  try {
    client = await beginBookingTransaction();

    // Make sure the account is still active.
    await lockActiveBookingUser(
      client,
      req.user.userId,
      "student"
    );

    // Lock the class to prevent simultaneous enrolment changes.
    const classResult = await client.query(
      `
        SELECT *
        FROM public.group_classes
        WHERE id = $1
        FOR UPDATE
      `,
      [id]
    );

    const groupClass = classResult.rows[0];

    if (!groupClass) {
      await rollbackBookingTransaction(client);
      return fail(res, 404, "Group class not found.");
    }

    // Only allow cancellation before the class starts.
    if (
      groupClass.status !== "published" ||
      new Date(groupClass.scheduled_at) <= new Date()
    ) {
      await rollbackBookingTransaction(client);

      return fail(
        res,
        409,
        "This class is no longer open for cancellation."
      );
    }

    // Find the enrolment belonging to the signed-in student.
    const enrollmentResult = await client.query(
      `
        SELECT *
        FROM public.group_class_enrollments
        WHERE class_id = $1
        AND student_id = $2
        FOR UPDATE
      `,
      [id, req.user.userId]
    );

    const enrollment = enrollmentResult.rows[0];

    if (!enrollment) {
      await rollbackBookingTransaction(client);

      return fail(res, 404, "Enrolment not found.");
    }

    // Prevent repeated cancellation.
    if (enrollment.enrollment_status === "cancelled") {
      await rollbackBookingTransaction(client);

      return fail(
        res,
        409,
        "This enrolment is already cancelled."
      );
    }

    // Only active enrolments can be cancelled.
    if (
      !["pending", "confirmed"].includes(
        enrollment.enrollment_status
      )
    ) {
      await rollbackBookingTransaction(client);

      return fail(
        res,
        409,
        "This enrolment cannot be cancelled."
      );
    }

    // Paid enrolments require payment and refund handling.
    if (
      Number(enrollment.amount_paid_cents) > 0 ||
      !["not_required", "unpaid", "failed"].includes(
        enrollment.payment_status
      )
    ) {
      await rollbackBookingTransaction(client);

      return fail(res, 409, "Payment review is required.");
    }

    // Cancel the enrolment without deleting its database record.
    // Cancelled enrolments are excluded from the class capacity count.
    const result = await client.query(
      `
        UPDATE public.group_class_enrollments
        SET
          enrollment_status = 'cancelled',
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [enrollment.id]
    );

    // Verify the database write before committing.
    if (
      result.command !== "UPDATE" ||
      result.rowCount !== 1 ||
      result.rows.length !== 1 ||
      result.rows[0].enrollment_status !== "cancelled"
    ) {
      throw new Error("Unexpected class write result.");
    }

    await commitBookingTransaction(client);

    // Confirm that the enrolment was cancelled.
    return res.json({
      success: true,
      message: "Your enrolment has been cancelled successfully.",
      enrollment: result.rows[0],
    });
  } catch (error) {
    if (client) {
      try {
        await abortBookingTransaction(client);
      } catch (rollbackError) {
        error = rollbackError;
      }
    }

    return groupTransactionError(
      res,
      error,
      "Unable to cancel enrolment."
    );
  } finally {
    if (client) {
      releaseBookingTransaction(client);
    }
  }
}

// Get a student's enrolled classes.
async function getMyEnrollments(req, res) {
  try {
    if (req.user.role !== "student") {
      return fail(res, 403, "Only students can view enrolments.");
    }

    const result = await pool.query(
      `
        SELECT
          gc.*,
          u.full_name AS tutor_name,
          e.id AS enrollment_id,
          e.enrollment_status,
          e.payment_status,
          e.amount_paid_cents,
          e.price_cents AS enrollment_price_cents,
          e.currency AS enrollment_currency,
          e.enrolled_at
        FROM public.group_class_enrollments e
        JOIN public.group_classes gc
          ON gc.id = e.class_id
        JOIN public.users u
          ON u.id = gc.tutor_id
        WHERE e.student_id = $1
        ORDER BY gc.scheduled_at ASC
      `,
      [req.user.userId]
    );

    res.json({
      success: true,
      enrollments: result.rows,
    });
  } catch (error) {
    console.error("Get enrolments error:", error.message);
    return fail(res, 500, "Unable to load your enrolments.");
  }
}

// Get students enrolled in a tutor's own class.
async function getClassStudents(req, res) {
  try {
    if (req.user.role !== "tutor") {
      return fail(res, 403, "Only tutors can view class participants.");
    }

    const { id } = req.params;

    if (!validId(id)) {
      return fail(res, 400, "Invalid class ID.");
    }

    const groupClass = await pool.query(
      `
        SELECT id
        FROM public.group_classes
        WHERE id = $1 AND tutor_id = $2
      `,
      [id, req.user.userId]
    );

    if (!groupClass.rows.length) {
      return fail(res, 404, "Group class not found.");
    }

    const result = await pool.query(
      `
        SELECT
          e.id AS enrollment_id,
          u.id AS student_id,
          u.full_name,
          e.enrollment_status,
          e.payment_status,
          e.price_cents,
          e.amount_paid_cents,
          e.platform_commission_cents,
          e.tutor_earnings_cents,
          e.currency,
          e.enrolled_at
        FROM public.group_class_enrollments e
        JOIN public.users u ON u.id = e.student_id
        WHERE e.class_id = $1
        ORDER BY e.enrolled_at ASC
      `,
      [id]
    );

    res.json({
      success: true,
      students: result.rows,
    });
  } catch (error) {
    console.error("Get class students error:", error.message);
    return fail(res, 500, "Unable to load class participants.");
  }
}

// Export controller functions.
module.exports = {
  getGroupClasses,
  getGroupClassById,
  getMyGroupClasses,
  createGroupClass,
  updateGroupClass,
  updateGroupClassStatus,
  enrollInGroupClass,
  cancelEnrollment,
  getMyEnrollments,
  getClassStudents,
};