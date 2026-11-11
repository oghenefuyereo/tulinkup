
const pool = require("../config/db");

const allowedDurations = new Set([30, 60, 90]);

// Convert HH:MM into minutes.
function minutes(time) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

// Validate booking date.
function validDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

// Validate booking time.
function validTime(value) {
  return (
    typeof value === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
  );
}

// CREATE BOOKING
async function createBooking(req, res) {
  const studentId = req.user?.userId;

  if (req.user?.role !== "student") {
    return res.status(403).json({
      error: "Only student accounts can request sessions.",
    });
  }

  const {
    tutorID,
    subjectID,
    date,
    startTime,
    duration,
    note,
  } = req.body || {};

  const tutorProfileId = String(tutorID ?? "").trim();
  const subject = String(subjectID ?? "").trim();
  const durationMinutes = Number(duration);

  if (
    !/^\d+$/.test(tutorProfileId) ||
    !subject ||
    !validDate(date) ||
    !validTime(startTime) ||
    !allowedDurations.has(durationMinutes)
  ) {
    return res.status(400).json({
      error: "Complete all booking details correctly.",
    });
  }

  if (
    typeof note !== "undefined" &&
    typeof note !== "string"
  ) {
    return res.status(400).json({
      error: "Invalid booking note.",
    });
  }

  const endMinutes = minutes(startTime) + durationMinutes;

  if (endMinutes > 1440) {
    return res.status(400).json({
      error: "Session cannot extend beyond midnight.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Find tutor profile and verify tutor account.
    const profileResult = await client.query(
      `SELECT
         tp.id,
         tp.user_id,
         tp.subject
       FROM public.tutor_profiles tp
       JOIN public.users u
         ON u.id = tp.user_id
       WHERE tp.id = $1
         AND u.role = 'tutor'`,
      [tutorProfileId]
    );

    const profile = profileResult.rows[0];

    if (!profile) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Tutor profile not found.",
      });
    }

    if (String(profile.user_id) === String(studentId)) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "You cannot book yourself.",
      });
    }

    // Validate the subject.
    if (
      !profile.subject ||
      profile.subject.trim().toLowerCase() !==
        subject.toLowerCase()
    ) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "The tutor does not offer this subject.",
      });
    }

    // Prevent concurrent requests for this tutor and date.
    await client.query(
      `SELECT pg_advisory_xact_lock(
         hashtext($1),
         hashtext($2)
       )`,
      [String(profile.user_id), date]
    );

    // Validate that the tutor has published this time.
    const availabilityResult = await client.query(
      `SELECT id
       FROM public.tutor_availability
       WHERE tutor_id = $1
         AND available_date = $2::date
         AND start_time <= $3::time
         AND end_time >= (
           $3::time +
           ($4::integer * INTERVAL '1 minute')
         )
       LIMIT 1`,
      [
        profile.user_id,
        date,
        startTime,
        durationMinutes,
      ]
    );

    if (!availabilityResult.rows.length) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error: "This time is not available.",
      });
    }

    // Check for overlapping bookings.
    const conflictResult = await client.query(
      `SELECT id
       FROM public.bookings
       WHERE tutor_id = $1
         AND booking_date = $2::date
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
        profile.user_id,
        date,
        startTime,
        durationMinutes,
      ]
    );

    if (conflictResult.rows.length) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error:
          "That time has just been booked. Please choose another.",
      });
    }

    // Reject sessions whose start time has passed.
    // This assumes booking dates/times use UTC.
    const nowResult = await client.query(
      `SELECT (
         $1::date + $2::time
       ) > (NOW() AT TIME ZONE 'UTC') AS is_future`,
      [date, startTime]
    );

    if (!nowResult.rows[0].is_future) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "Cannot book a session in the past.",
      });
    }

    // Save the booking.
    const bookingResult = await client.query(
      `INSERT INTO public.bookings (
         student_id,
         tutor_id,
         booking_date,
         booking_time,
         duration_minutes,
         student_note,
         status
       )
       VALUES (
         $1,
         $2,
         $3::date,
         $4::time,
         $5,
         $6,
         'pending'
       )
       RETURNING id, status`,
      [
        studentId,
        profile.user_id,
        date,
        startTime,
        durationMinutes,
        (note || "").trim().slice(0, 500),
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      id: bookingResult.rows[0].id,
      status: bookingResult.rows[0].status,
      message: "Booking request submitted successfully.",
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    console.error("Booking creation error:", error);

    return res.status(500).json({
      error: "Unable to create booking.",
    });
  } finally {
    client.release();
  }
}

// UPDATE BOOKING STATUS
async function updateBookingStatus(req, res) {
  const bookingId = String(req.params.id ?? "").trim();
  const newStatus = req.body?.status;
  const userId = req.user?.userId;
  const role = req.user?.role;

  const allowedStatuses = [
    "accepted",
    "declined",
    "completed",
    "cancelled",
  ];

  if (
    !/^\d+$/.test(bookingId) ||
    !allowedStatuses.includes(newStatus)
  ) {
    return res.status(400).json({
      error: "Invalid booking update.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock booking record during update.
    const result = await client.query(
      `SELECT
         id,
         student_id,
         tutor_id,
         booking_date,
         booking_time,
         duration_minutes,
         status
       FROM public.bookings
       WHERE id = $1
       FOR UPDATE`,
      [bookingId]
    );

    const booking = result.rows[0];

    if (!booking) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Booking not found.",
      });
    }

    // Verify booking ownership.
    const isStudent =
      role === "student" &&
      String(booking.student_id) === String(userId);

    const isTutor =
      role === "tutor" &&
      String(booking.tutor_id) === String(userId);

    if (!isStudent && !isTutor) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        error: "You cannot manage this booking.",
      });
    }

    // Define valid status transitions.
    const transitions = {
      pending: {
        student: ["cancelled"],
        tutor: ["accepted", "declined"],
      },
      accepted: {
        student: ["cancelled"],
        tutor: ["completed", "cancelled"],
      },
      declined: {
        student: [],
        tutor: [],
      },
      cancelled: {
        student: [],
        tutor: [],
      },
      completed: {
        student: [],
        tutor: [],
      },
    };

    const permittedStatuses =
      transitions[booking.status]?.[role] ?? [];

    if (!permittedStatuses.includes(newStatus)) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error:
          `Cannot change a ${booking.status} booking to ${newStatus}.`,
      });
    }

    // Mark completed only after the session has ended.
    // This assumes booking dates/times use UTC.
    if (newStatus === "completed") {
      const endResult = await client.query(
        `SELECT (
           $1::date +
           $2::time +
           ($3::integer * INTERVAL '1 minute')
         ) <= (NOW() AT TIME ZONE 'UTC') AS has_ended`,
        [
          booking.booking_date,
          booking.booking_time,
          booking.duration_minutes,
        ]
      );

      if (!endResult.rows[0].has_ended) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          error:
            "A session can only be completed after it ends.",
        });
      }
    }

    // Update status.
    const updated = await client.query(
      `UPDATE public.bookings
       SET status = $1
       WHERE id = $2
       RETURNING id, status`,
      [newStatus, bookingId]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Booking status updated successfully.",
      booking: updated.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    console.error("Booking status update error:", error);

    return res.status(500).json({
      error: "Unable to update booking.",
    });
  } finally {
    client.release();
  }
}

async function getBookings(req, res) {
  const userId = req.user?.userId;
  const role = req.user?.role;

  if (!userId || !["student", "tutor"].includes(role)) {
    return res.status(403).json({
      error: "Access denied.",
    });
  }

  try {
    const isStudent = role === "student";

    const result = await pool.query(
      `SELECT
         b.id,
         b.booking_date AS date,
         b.booking_time AS "startTime",
         b.duration_minutes AS duration,
         b.student_note AS note,
         b.status,
         b.created_at,
         s.full_name AS "studentName",
         t.full_name AS "tutorName",
         tp.subject AS "subjectName"
       FROM public.bookings b
       JOIN public.users s
         ON s.id = b.student_id
       JOIN public.users t
         ON t.id = b.tutor_id
       LEFT JOIN public.tutor_profiles tp
         ON tp.user_id = b.tutor_id
       WHERE ${
         isStudent
           ? "b.student_id = $1"
           : "b.tutor_id = $1"
       }
       ORDER BY b.booking_date DESC, b.booking_time DESC`,
      [userId]
    );

    return res.json({
      success: true,
      bookings: result.rows,
    });
  } catch (error) {
    console.error("Fetch bookings error:", error);

    return res.status(500).json({
      error: "Unable to load bookings.",
    });
  }
}

module.exports = {
  createBooking,
  updateBookingStatus,
  getBookings,
};