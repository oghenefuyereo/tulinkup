// Import the database connection.
const pool = require("../config/db");

// Import the Node.js UUID generator.
const { randomUUID } = require("node:crypto");

// Import the LiveKit configuration.
const {
  LIVEKIT_URL,
  roomService,
  generateLiveKitToken,
} = require("../config/livekit");

// Use the original pricing rules to validate existing bookings and enrolments.
const {
  PRICING: ORIGINAL_PRICING,
  calculatePrivateSessionPrice,
  validateGroupPricing,
} = require("../utils/pricing");

// Configure the classroom access window.
const EARLY_ACCESS_MINUTES = 15;
const GRACE_PERIOD_MINUTES = 15;

// Create a consistent error response.
function fail(res, status, message) {
  return res.status(status).json({
    success: false,
    message,
  });
}

// Validate the session type and reference ID.
function validSession(type, id) {
  return (
    ["one_on_one", "group"].includes(type) &&
    /^[1-9]\d*$/.test(String(id))
  );
}

// Check whether a stored monetary amount is valid.
function validAmount(value) {
  return (
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

// Verify the pricing and payment of a private booking.
function hasValidPrivatePayment(booking) {
  const {
    hourly_rate_cents,
    total_price_cents,
    platform_commission_cents,
    tutor_earnings_cents,
    duration_minutes,
    currency,
    payment_status,
  } = booking;

  // Reject bookings without valid stored pricing.
  if (
    !validAmount(hourly_rate_cents) ||
    !validAmount(total_price_cents) ||
    !validAmount(platform_commission_cents) ||
    !validAmount(tutor_earnings_cents) ||
    currency !== ORIGINAL_PRICING.CURRENCY
  ) {
    return false;
  }

  // Verify the original session price.
  try {
    const expectedPrice =
      calculatePrivateSessionPrice(
        hourly_rate_cents,
        duration_minutes,
        ORIGINAL_PRICING
      );

    if (expectedPrice !== total_price_cents) {
      return false;
    }
  } catch {
    return false;
  }

  // Verify the stored revenue breakdown.
  if (
    platform_commission_cents +
      tutor_earnings_cents !==
    total_price_cents
  ) {
    return false;
  }

  // Free sessions do not require payment.
  if (total_price_cents === 0) {
    return payment_status === "not_required";
  }

  // Paid sessions require a verified payment status.
  return payment_status === "paid";
}

// Verify the original group class pricing and capacity.
function hasValidGroupPricing(classroom) {
  if (
    !validAmount(classroom.price_cents) ||
    classroom.currency !== ORIGINAL_PRICING.CURRENCY
  ) {
    return false;
  }

  try {
    validateGroupPricing(
      classroom.price_cents,
      classroom.minimum_students,
      classroom.maximum_students,
      ORIGINAL_PRICING
    );

    return true;
  } catch {
    return false;
  }
}

// Verify a student's group class payment.
function hasValidGroupPayment(
  enrollment,
  classroom
) {
  if (
    !enrollment ||
    enrollment.enrollment_status !== "confirmed" ||
    enrollment.currency !== ORIGINAL_PRICING.CURRENCY ||
    !validAmount(enrollment.amount_paid_cents)
  ) {
    return false;
  }

  // Use the price stored when the student enrolled.
  let priceCents = enrollment.price_cents;

  // Preserve older confirmed free enrolments.
  if (
    priceCents === null &&
    classroom.price_cents === 0 &&
    enrollment.payment_status === "not_required" &&
    enrollment.amount_paid_cents === 0
  ) {
    priceCents = 0;
  }

  // Reject missing or invalid enrolment prices.
  if (
    !validAmount(priceCents) ||
    priceCents > ORIGINAL_PRICING.MAX_GROUP_PRICE_CENTS
  ) {
    return false;
  }

  // Free enrolments must not contain a payment.
  if (priceCents === 0) {
    return (
      enrollment.payment_status === "not_required" &&
      enrollment.amount_paid_cents === 0
    );
  }

  // Paid enrolments require payment of the stored price.
  return (
    enrollment.payment_status === "paid" &&
    enrollment.amount_paid_cents >= priceCents
  );
}

// Retrieve the booking or group class.
async function getClassroom(client, type, id) {
  if (type === "one_on_one") {
    const result = await client.query(
      `
      SELECT *,
        (
          (booking_date + booking_time)
          AT TIME ZONE 'America/Toronto'
        ) AS scheduled_at
      FROM public.bookings
      WHERE id = $1
      FOR UPDATE
      `,
      [id]
    );

    return result.rows[0];
  }

  const result = await client.query(
    `
    SELECT *
    FROM public.group_classes
    WHERE id = $1
    FOR UPDATE
    `,
    [id]
  );

  return result.rows[0];
}

// Retrieve the associated live session.
async function getLiveSession(client, type, id) {
  const column =
    type === "one_on_one"
      ? "booking_id"
      : "group_class_id";

  const result = await client.query(
    `
    SELECT *
    FROM public.live_sessions
    WHERE session_type = $1
      AND ${column} = $2
    FOR UPDATE
    `,
    [type, id]
  );

  return result.rows[0];
}

// Retrieve a student's group class enrolment.
async function getEnrollment(
  client,
  classId,
  studentId
) {
  const result = await client.query(
    `
    SELECT
      id,
      class_id,
      student_id,
      price_cents,
      amount_paid_cents,
      currency,
      payment_status,
      enrollment_status
    FROM public.group_class_enrollments
    WHERE class_id = $1
      AND student_id = $2
    FOR UPDATE
    `,
    [classId, studentId]
  );

  return result.rows[0];
}

// Check whether the participant belongs to the classroom.
async function hasAccess(
  client,
  classroom,
  type,
  user
) {
  if (user.role === "tutor") {
    return (
      String(classroom.tutor_id) ===
      String(user.id)
    );
  }

  if (user.role !== "student") {
    return false;
  }

  // Verify the assigned one-on-one student.
  if (type === "one_on_one") {
    return (
      String(classroom.student_id) ===
      String(user.id)
    );
  }

  // Verify the student's group class enrolment.
  const enrollment = await getEnrollment(
    client,
    classroom.id,
    user.id
  );

  return (
    enrollment?.enrollment_status === "confirmed"
  );
}

// Check whether classroom payment requirements are satisfied.
async function hasEligiblePayment(
  client,
  classroom,
  type,
  user
) {
  // Both participants must satisfy private booking payment rules.
  if (type === "one_on_one") {
    return hasValidPrivatePayment(classroom);
  }

  // Verify the original group class pricing and capacity.
  if (!hasValidGroupPricing(classroom)) {
    return false;
  }

  // Tutors do not pay to teach their own group classes.
  if (user.role === "tutor") {
    return true;
  }

  // Verify the student's stored enrolment and payment.
  const enrollment = await getEnrollment(
    client,
    classroom.id,
    user.id
  );

  return hasValidGroupPayment(
    enrollment,
    classroom
  );
}

// Check whether the classroom can be accessed.
function withinAccessWindow(classroom) {
  const scheduled = new Date(
    classroom.scheduled_at
  ).getTime();

  const duration =
    Number(classroom.duration_minutes) *
    60 *
    1000;

  // Reject invalid scheduling information.
  if (
    !Number.isFinite(scheduled) ||
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    return false;
  }

  const earliest =
    scheduled -
    EARLY_ACCESS_MINUTES * 60 * 1000;

  const latest =
    scheduled +
    duration +
    GRACE_PERIOD_MINUTES * 60 * 1000;

  const now = Date.now();

  return now >= earliest && now < latest;
}

// Retrieve the authenticated user from the database.
async function getUser(client, userId) {
  const result = await client.query(
    `
    SELECT id, full_name, role
    FROM public.users
    WHERE id = $1
    `,
    [userId]
  );

  return result.rows[0];
}

// Check whether the booking or class is active.
function isActiveClassroom(type, classroom) {
  if (type === "one_on_one") {
    return classroom.status === "accepted";
  }

  return ["published", "live"].includes(
    classroom.status
  );
}

// Manage classroom actions inside a transaction.
async function handleSession(req, res, action) {
  const { type, id } =
    action === "status"
      ? req.params
      : req.body || {};

  res.set("Cache-Control", "no-store");

  if (!validSession(type, id)) {
    return fail(
      res,
      400,
      "Invalid session type or ID."
    );
  }

  if (!req.user?.userId) {
    return fail(
      res,
      401,
      "Log in to access the classroom."
    );
  }

  let client;

  try {
    client = await pool.connect();

    await client.query("BEGIN");

    // Roll back unsuccessful classroom requests.
    async function reject(status, message) {
      await client.query("ROLLBACK");
      return fail(res, status, message);
    }

    // Verify the authenticated user's account.
    const user = await getUser(
      client,
      req.user.userId
    );

    if (
      !user ||
      user.role !== req.user.role
    ) {
      return await reject(
        403,
        "Invalid user account."
      );
    }

    // Restrict starting and ending to tutors.
    if (
      ["start", "end"].includes(action) &&
      user.role !== "tutor"
    ) {
      return await reject(
        403,
        "Only tutors can perform this action."
      );
    }

    // Retrieve the requested classroom.
    const classroom = await getClassroom(
      client,
      type,
      id
    );

    if (!classroom) {
      return await reject(
        404,
        "Classroom not found."
      );
    }

    // Verify ownership or student enrolment.
    const authorized = await hasAccess(
      client,
      classroom,
      type,
      user
    );

    if (!authorized) {
      return await reject(
        403,
        "You do not have access to this classroom."
      );
    }

    // Retrieve the existing live session.
    let session = await getLiveSession(
      client,
      type,
      id
    );

    // Verify pricing and payment before granting classroom access.
    const eligiblePayment =
      action === "end"
        ? false
        : await hasEligiblePayment(
            client,
            classroom,
            type,
            user
          );

    // Return the current classroom status.
    if (action === "status") {
      const activeClassroom =
        isActiveClassroom(type, classroom);

      const insideAccessWindow =
        withinAccessWindow(classroom);

      const canStart =
        user.role === "tutor" &&
        eligiblePayment &&
        activeClassroom &&
        insideAccessWindow &&
        (
          !session ||
          session.status === "scheduled"
        );

      const canJoin =
        eligiblePayment &&
        session?.status === "live" &&
        activeClassroom &&
        insideAccessWindow;

      await client.query("COMMIT");

      return res.json({
        success: true,
        session,
        classroomStatus: classroom.status,
        paymentEligible: eligiblePayment,
        canStart,
        canJoin,
      });
    }

    // Start or join a classroom.
    if (["start", "join"].includes(action)) {
      if (!eligiblePayment) {
        return await reject(
          403,
          "Classroom access requires valid pricing and verified payment."
        );
      }

      if (!isActiveClassroom(type, classroom)) {
        return await reject(
          409,
          "This classroom is not available."
        );
      }

      if (!withinAccessWindow(classroom)) {
        return await reject(
          409,
          "Classroom access is only available near the scheduled time."
        );
      }
    }

    // Start a classroom.
    if (action === "start") {
      if (
        session &&
        ["completed", "cancelled"].includes(
          session.status
        )
      ) {
        return await reject(
          409,
          "This classroom has already ended."
        );
      }

      // Create a unique classroom record.
      if (!session) {
        const roomName =
          `tulinkup-${type}-${randomUUID()}`;

        const result = await client.query(
          `
          INSERT INTO public.live_sessions (
            session_type,
            booking_id,
            group_class_id,
            room_name,
            status
          )
          VALUES ($1, $2, $3, $4, 'scheduled')
          RETURNING *
          `,
          [
            type,
            type === "one_on_one" ? id : null,
            type === "group" ? id : null,
            roomName,
          ]
        );

        session = result.rows[0];
      }

      // Start the LiveKit room.
      if (session.status === "scheduled") {
        await roomService.createRoom({
          name: session.room_name,
          emptyTimeout: 300,
          maxParticipants:
            type === "one_on_one"
              ? 2
              : Number(
                  classroom.maximum_students
                ) + 1,
        });

        // Update the live session status.
        const result = await client.query(
          `
          UPDATE public.live_sessions
          SET status = 'live',
              started_at = NOW(),
              updated_at = NOW()
          WHERE id = $1
          RETURNING *
          `,
          [session.id]
        );

        session = result.rows[0];

        // Update the group class status.
        if (type === "group") {
          await client.query(
            `
            UPDATE public.group_classes
            SET status = 'live',
                updated_at = NOW()
            WHERE id = $1
            `,
            [id]
          );
        }
      }
    }

    // Prevent participants from joining inactive rooms.
    if (["start", "join"].includes(action)) {
      if (!session || session.status !== "live") {
        return await reject(
          409,
          "The tutor has not started this classroom."
        );
      }

      // Generate a token only after access checks succeed.
      const token = await generateLiveKitToken({
        roomName: session.room_name,
        userId: user.id,
        fullName: user.full_name,
      });

      await client.query("COMMIT");

      return res.json({
        success: true,
        message:
          action === "start"
            ? "Classroom started successfully."
            : "Classroom access granted.",
        session,
        token,
        serverUrl: LIVEKIT_URL,
      });
    }

    // Allow the assigned tutor to end the classroom.
    if (action === "end") {
      if (!session) {
        return await reject(
          404,
          "Live session not found."
        );
      }

      // Allow safe retries after completion.
      if (session.status === "completed") {
        await client.query("COMMIT");

        return res.json({
          success: true,
          message: "Classroom has already ended.",
          session,
        });
      }

      if (session.status !== "live") {
        return await reject(
          409,
          "This classroom is not currently live."
        );
      }

      // Disconnect classroom participants.
      const rooms = await roomService.listRooms([
        session.room_name,
      ]);

      if (rooms.length > 0) {
        await roomService.deleteRoom(
          session.room_name
        );
      }

      // Complete the live session.
      const result = await client.query(
        `
        UPDATE public.live_sessions
        SET status = 'completed',
            ended_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
        `,
        [session.id]
      );

      session = result.rows[0];

      // Complete the private booking if its payment remains valid.
      if (
        type === "one_on_one" &&
        hasValidPrivatePayment(classroom)
      ) {
        await client.query(
          `
          UPDATE public.bookings
          SET status = 'completed'
          WHERE id = $1
            AND status = 'accepted'
          `,
          [id]
        );
      }

      // Complete the associated group class.
      if (type === "group") {
        await client.query(
          `
          UPDATE public.group_classes
          SET status = 'completed',
              updated_at = NOW()
          WHERE id = $1
            AND status = 'live'
          `,
          [id]
        );
      }

      await client.query("COMMIT");

      return res.json({
        success: true,
        message: "Classroom ended successfully.",
        session,
      });
    }

    return await reject(
      400,
      "Invalid classroom action."
    );
  } catch (error) {
    if (client) {
      await client
        .query("ROLLBACK")
        .catch(() => {});
    }

    console.error(
      "Live session error:",
      error.message
    );

    return fail(
      res,
      500,
      "Unable to process the classroom request."
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Start a live classroom.
async function startSession(req, res) {
  return handleSession(req, res, "start");
}

// Join a live classroom.
async function joinSession(req, res) {
  return handleSession(req, res, "join");
}

// End a live classroom.
async function endSession(req, res) {
  return handleSession(req, res, "end");
}

// Retrieve a live classroom's status.
async function getSessionStatus(req, res) {
  return handleSession(req, res, "status");
}

// Export the classroom controllers.
module.exports = {
  startSession,
  joinSession,
  endSession,
  getSessionStatus,
};