// Import the database connection to manage student bookings.
const pool = require("../config/db");

// Import shared scheduling conflict validation.
const {
  lockTutorSchedule,
  hasGroupClassConflict,
  getBookingStartTime,
} = require("../utils/schedulingConflict");

// Import the platform pricing rules.
const {
  PRICING,
  getPricingConfig,
  validatePrivatePricing,
  calculatePrivateSessionPrice,
  calculateRevenueSplit,
  getInitialPaymentStatus,
} = require("../utils/pricing");

// These are the session lengths students can choose, in minutes.
const VALID_DURATIONS = [30, 60, 90];

// Check that the date is valid and follows the YYYY-MM-DD format.
function isValidDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  // Convert the date into a JavaScript Date object.
  const date = new Date(`${value}T00:00:00Z`);

  // Make sure the date exists and matches the original value.
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

// Check that the time uses a valid 24-hour format.
function isValidTime(value) {
  return (
    typeof value === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value)
  );
}

// Convert the tutor's stored hourly rate into Canadian cents.
function getHourlyRateCents(hourlyRate, pricing) {
  if (
    hourlyRate === null ||
    hourlyRate === undefined ||
    !["number", "string"].includes(typeof hourlyRate) ||
    String(hourlyRate).trim() === ""
  ) {
    throw new Error(
      "This tutor has not configured an hourly rate."
    );
  }

  const rate = Number(hourlyRate);

  if (
    !Number.isFinite(rate) ||
    rate < pricing.MIN_PRIVATE_HOURLY_RATE_CENTS / 100 ||
    rate > pricing.MAX_PRIVATE_HOURLY_RATE_CENTS / 100
  ) {
    throw new Error(
      "This tutor has an invalid hourly rate."
    );
  }

  const hourlyRateCents = Math.round(rate * 100);

  if (
    Math.abs(rate * 100 - hourlyRateCents) > 0.000001
  ) {
    throw new Error(
      "This tutor has an invalid hourly rate."
    );
  }

  validatePrivatePricing(
    hourlyRateCents,
    pricing
  );

  return hourlyRateCents;
}

// Check whether the booking's payment requirements are satisfied.
function hasValidBookingPayment(booking) {
  if (
    booking.total_price_cents === null ||
    booking.total_price_cents === undefined ||
    booking.currency !== PRICING.CURRENCY
  ) {
    return false;
  }

  const totalPriceCents = Number(
    booking.total_price_cents
  );

  if (
    !Number.isSafeInteger(totalPriceCents) ||
    totalPriceCents < 0
  ) {
    return false;
  }

  return (
    (
      totalPriceCents === 0 &&
      booking.payment_status === "not_required"
    ) ||
    (
      totalPriceCents > 0 &&
      booking.payment_status === "paid"
    )
  );
}

// Organize booking information into an object for the frontend.
function formatBooking(row) {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    tutorId: String(row.tutor_id),
    date: row.booking_date,
    startTime: row.booking_time,
    duration: row.duration_minutes,
    subject: row.subject_name,
    studentNote: row.student_note,
    status: row.status,
    studentName: row.student_name,
    tutorName: row.tutor_name,
    createdAt: row.created_at,

    // Include the pricing information stored when the booking was created.
    hourlyRateCents: row.hourly_rate_cents ?? null,
    totalPriceCents: row.total_price_cents ?? null,
    platformCommissionCents:
      row.platform_commission_cents ?? null,
    tutorEarningsCents:
      row.tutor_earnings_cents ?? null,
    currency: row.currency ?? null,
    paymentStatus: row.payment_status ?? null,
  };
}

// Get the bookings that belong to the logged-in student or tutor.
async function getBookings(req, res) {
  try {
    // Get the user's ID and role from their authentication details.
    const { userId, role } = req.user;

    // Only students and tutors can view bookings.
    if (!["student", "tutor"].includes(role)) {
      return res.status(403).json({
        error: "Access denied.",
      });
    }

    // Students see their own bookings, while tutors see bookings made with them.
    const column =
      role === "student"
        ? "b.student_id"
        : "b.tutor_id";

    // Get the bookings and include the student and tutor names.
    const result = await pool.query(
      `SELECT
         b.*,
         s.full_name AS student_name,
         t.full_name AS tutor_name
       FROM public.bookings b
       JOIN public.users s ON s.id = b.student_id
       JOIN public.users t ON t.id = b.tutor_id
       WHERE ${column} = $1
       ORDER BY b.booking_date DESC, b.booking_time DESC`,
      [userId]
    );

    // Send the bookings back in a consistent format.
    return res.json({
      success: true,
      bookings: result.rows.map(formatBooking),
    });
  } catch (error) {
    // Log any errors that happen while loading bookings.
    console.error("Get bookings error:", error);

    return res.status(500).json({
      error: "Unable to load bookings.",
    });
  }
}

// Allow a student to request a session with a tutor.
async function createBooking(req, res) {
  let client;

  try {
    // Only students can create booking requests.
    if (
      !req.user?.userId ||
      req.user?.role !== "student"
    ) {
      return res.status(403).json({
        error: "Only students can request bookings.",
      });
    }

    // Get the booking details submitted by the student.
    const {
      tutorID,
      slotID,
      subjectID,
      date,
      startTime,
      duration,
      note = "",
    } = req.body || {};

    // Convert the selected session duration into a number.
    const durationMinutes = Number(duration);

    // Check that all required booking details are valid.
    if (
      !tutorID ||
      !slotID ||
      !subjectID ||
      !isValidDate(date) ||
      !isValidTime(startTime) ||
      !VALID_DURATIONS.includes(durationMinutes) ||
      typeof note !== "string" ||
      note.length > 500
    ) {
      return res.status(400).json({
        error: "Invalid booking information.",
      });
    }

    // Get a database connection for the booking transaction.
    client = await pool.connect();

    // Start a transaction so the booking checks and insert stay together.
    await client.query("BEGIN");

    // Find the selected tutor and retrieve the current hourly rate.
    const tutorResult = await client.query(
      `SELECT
         tp.id AS profile_id,
         tp.user_id,
         tp.subject,
         tp.hourly_rate
       FROM public.tutor_profiles tp
       JOIN public.users u ON u.id = tp.user_id
       WHERE tp.id = $1
         AND u.role = 'tutor'
       LIMIT 1`,
      [tutorID]
    );

    // Stop the booking if the tutor profile does not exist.
    if (!tutorResult.rows.length) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Tutor not found.",
      });
    }

    // Get the tutor's profile information.
    let tutor = tutorResult.rows[0];

    // Lock the tutor's schedule before checking availability.
    // This prevents simultaneous conflicting booking and class requests.
    await lockTutorSchedule(client, tutor.user_id);

    // Retrieve and lock the latest tutor profile before calculating pricing.
    const pricingResult = await client.query(
      `SELECT
         id AS profile_id,
         user_id,
         subject,
         hourly_rate
       FROM public.tutor_profiles
       WHERE id = $1
         AND user_id = $2
       FOR SHARE`,
      [tutor.profile_id, tutor.user_id]
    );

    // Stop if the tutor profile is no longer available.
    if (!pricingResult.rows.length) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Tutor profile is no longer available.",
      });
    }

    tutor = pricingResult.rows[0];

    // Retrieve the current platform pricing configuration.
    const pricing = await getPricingConfig(client);

    // Store the validated hourly rate and session price.
    let hourlyRateCents;
    let totalPriceCents;
    let revenue;
    let paymentStatus;

    try {
      // Use the tutor's current hourly rate from the database.
      hourlyRateCents = getHourlyRateCents(
        tutor.hourly_rate,
        pricing
      );

      // Calculate the session price based on its duration.
      totalPriceCents = calculatePrivateSessionPrice(
        hourlyRateCents,
        durationMinutes,
        pricing
      );

      // Calculate the platform commission and tutor earnings.
      revenue = calculateRevenueSplit(
        totalPriceCents,
        pricing
      );

      // Prevent a paid hourly rate from being treated as a free session.
      if (
        hourlyRateCents > 0 &&
        totalPriceCents === 0
      ) {
        throw new Error(
          "The calculated session price is too low."
        );
      }

      // Determine the payment status using the current platform settings.
      paymentStatus = getInitialPaymentStatus(
        totalPriceCents,
        pricing
      );
    } catch (error) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error: error.message,
      });
    }

    // Prevent paid bookings until Stripe checkout is implemented.
    if (totalPriceCents > 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error:
          "Payment processing is not available yet. Please choose a free tutoring session.",
      });
    }

    // Turn the tutor's subject list into an array.
    const tutorSubjects = String(tutor.subject || "")
      .split(",")
      .map((subject) => subject.trim())
      .filter(Boolean);

    // Make sure the tutor offers the subject selected by the student.
    if (!tutorSubjects.includes(String(subjectID))) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "This tutor does not offer that subject.",
      });
    }

    // Find the selected time slot and lock it while processing the booking.
    const slotResult = await client.query(
      `SELECT
         id,
         available_date,
         start_time,
         end_time
       FROM public.tutor_availability
       WHERE id = $1
         AND tutor_id = $2
         AND is_available = TRUE
         AND available_date = $3
         AND start_time = $4
       FOR UPDATE`,
      [
        slotID,
        tutor.user_id,
        date,
        startTime,
      ]
    );

    // Stop if the selected time slot is no longer available.
    if (!slotResult.rows.length) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error: "This time slot is no longer available.",
      });
    }

    // Get the available time slot from the database.
    const slot = slotResult.rows[0];

    // Convert a time value into minutes so it is easier to compare.
    const toMinutes = (value) => {
      const [hours, minutes] = String(value)
        .split(":")
        .map(Number);

      return hours * 60 + minutes;
    };

    // Calculate when the available slot starts and ends.
    const startMinutes = toMinutes(slot.start_time);
    const endMinutes = toMinutes(slot.end_time);

    // Make sure the requested session fits within the available time.
    if (startMinutes + durationMinutes > endMinutes) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error:
          "The selected slot is too short for this duration.",
      });
    }

    // Check whether another active booking overlaps with this time.
    const conflict = await client.query(
      `SELECT id
       FROM public.bookings
       WHERE tutor_id = $1
         AND booking_date = $2
         AND status IN ('pending', 'accepted')
         AND booking_time < (
           $3::time +
           ($4::integer * INTERVAL '1 minute')
         )
         AND (
           booking_time +
           (duration_minutes * INTERVAL '1 minute')
         ) > $3::time
       LIMIT 1`,
      [
        tutor.user_id,
        date,
        startTime,
        durationMinutes,
      ]
    );

    // Prevent the tutor from receiving overlapping booking requests.
    if (conflict.rows.length) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error:
          "This tutor already has a booking at that time.",
      });
    }

    // Convert the requested booking date and time into
    // a timezone-aware timestamp for scheduling validation.
    const bookingStartTime = await getBookingStartTime(
      client,
      date,
      startTime
    );

    // Prevent students from booking tutoring sessions in the past.
    if (new Date(bookingStartTime) <= new Date()) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error:
          "You cannot book a tutoring session in the past.",
      });
    }

    // Check whether the tutor has a conflicting group class.
    const groupConflict = await hasGroupClassConflict(
      client,
      tutor.user_id,
      bookingStartTime,
      durationMinutes
    );

    // Prevent one-on-one bookings that overlap with group classes.
    if (groupConflict) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error:
          "This tutor has a group class scheduled at that time.",
      });
    }

    // Save the booking and its agreed pricing information.
    const result = await client.query(
      `INSERT INTO public.bookings
        (
          student_id,
          tutor_id,
          booking_date,
          booking_time,
          duration_minutes,
          subject_name,
          student_note,
          status,
          hourly_rate_cents,
          total_price_cents,
          platform_commission_cents,
          tutor_earnings_cents,
          currency,
          payment_status
        )
       VALUES (
         $1,
         $2,
         $3,
         $4,
         $5,
         $6,
         $7,
         'pending',
         $8,
         $9,
         $10,
         $11,
         $12,
         $13
       )
       RETURNING *`,
      [
        req.user.userId,
        tutor.user_id,
        date,
        startTime,
        durationMinutes,
        String(subjectID),
        note.trim(),
        hourlyRateCents,
        totalPriceCents,
        revenue.platformCommissionCents,
        revenue.tutorEarningsCents,
        revenue.currency,
        paymentStatus,
      ]
    );

    // Save the transaction after the booking is created successfully.
    await client.query("COMMIT");

    // Confirm that the booking request was submitted.
    return res.status(201).json({
      success: true,
      message: "Booking request submitted.",
      booking: result.rows[0],
    });
  } catch (error) {
    // Undo the transaction if something goes wrong.
    if (client) {
      await client.query("ROLLBACK").catch(
        (rollbackError) => {
          console.error(
            "Booking rollback error:",
            rollbackError
          );
        }
      );
    }

    console.error("Create booking error:", error);

    return res.status(500).json({
      error: "Unable to create booking.",
    });
  } finally {
    // Release the database connection when the request is finished.
    if (client) {
      client.release();
    }
  }
}

// Allow students and tutors to update a booking's status.
async function updateBookingStatus(req, res) {
  let client;

  try {
    // Get the current user's details and the requested status.
    const { userId, role } = req.user;
    const { status } = req.body || {};

    // Only students and tutors can update booking statuses.
    if (
      !userId ||
      !["student", "tutor"].includes(role)
    ) {
      return res.status(403).json({
        error: "Access denied.",
      });
    }

    // Only accept the booking statuses supported by the application.
    if (
      ![
        "accepted",
        "declined",
        "cancelled",
        "completed",
      ].includes(status)
    ) {
      return res.status(400).json({
        error: "Invalid booking status.",
      });
    }

    // Get a database connection for the status update.
    client = await pool.connect();

    // Start a transaction before updating the booking.
    await client.query("BEGIN");

    // Find the booking and lock it while checking the status change.
    const result = await client.query(
      `SELECT *
       FROM public.bookings
       WHERE id = $1
       FOR UPDATE`,
      [req.params.id]
    );

    // Stop if the booking does not exist.
    if (!result.rows.length) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Booking not found.",
      });
    }

    // Get the existing booking details.
    const booking = result.rows[0];

    // Check whether the logged-in student owns this booking.
    const isStudent =
      role === "student" &&
      String(booking.student_id) === String(userId);

    // Check whether the logged-in tutor is assigned to this booking.
    const isTutor =
      role === "tutor" &&
      String(booking.tutor_id) === String(userId);

    // Prevent other users from changing someone else's booking.
    if (!isStudent && !isTutor) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        error: "You cannot update this booking.",
      });
    }

    // Start by assuming the requested status change is not allowed.
    let allowed = false;

    // Students can cancel bookings that are pending or accepted.
    if (isStudent) {
      allowed =
        ["pending", "accepted"].includes(
          booking.status
        ) && status === "cancelled";
    }

    // Tutors can accept or decline pending bookings.
    // They can also mark accepted bookings as completed.
    if (isTutor) {
      allowed =
        (booking.status === "pending" &&
          ["accepted", "declined"].includes(status)) ||
        (booking.status === "accepted" &&
          status === "completed");
    }

    // Reject status changes that do not follow these rules.
    if (!allowed) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "That status change is not allowed.",
      });
    }

    // Prevent cancellation or rejection while a payment requires handling.
    if (
      ["cancelled", "declined"].includes(status) &&
      ["paid", "pending"].includes(
        booking.payment_status
      )
    ) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error:
          "This booking requires payment or refund processing before its status can be changed.",
      });
    }

    // Prevent bookings without verified pricing or payment from proceeding.
    if (
      ["accepted", "completed"].includes(status) &&
      !hasValidBookingPayment(booking)
    ) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error:
          booking.total_price_cents === null
            ? "This booking does not have verified pricing information."
            : "Payment requirements must be satisfied before proceeding.",
      });
    }

    // Update the booking status without changing its stored pricing.
    const updated = await client.query(
      `UPDATE public.bookings
       SET status = $1
       WHERE id = $2
       RETURNING *`,
      [status, booking.id]
    );

    // Save the changes once the update succeeds.
    await client.query("COMMIT");

    // Send the updated booking information back to the frontend.
    return res.json({
      success: true,
      message: "Booking updated successfully.",
      booking: formatBooking(updated.rows[0]),
    });
  } catch (error) {
    // Undo any changes if the update fails.
    if (client) {
      await client.query("ROLLBACK").catch(
        (rollbackError) => {
          console.error(
            "Booking status rollback error:",
            rollbackError
          );
        }
      );
    }

    console.error("Update booking error:", error);

    return res.status(500).json({
      error: "Unable to update booking.",
    });
  } finally {
    // Return the database connection to the pool.
    if (client) {
      client.release();
    }
  }
}

// Export the booking functions so they can be used in the routes.
module.exports = {
  getBookings,
  createBooking,
  updateBookingStatus,
};