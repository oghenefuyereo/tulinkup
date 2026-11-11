
const pool = require("../config/db");

const VALID_DURATIONS = [30, 60, 90];

function isValidDate(value) {
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

function isValidTime(value) {
  return (
    typeof value === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value)
  );
}

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
  };
}

async function getBookings(req, res) {
  try {
    const { userId, role } = req.user;

    if (!["student", "tutor"].includes(role)) {
      return res.status(403).json({
        error: "Access denied.",
      });
    }

    const column =
      role === "student"
        ? "b.student_id"
        : "b.tutor_id";

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

    return res.json({
      success: true,
      bookings: result.rows.map(formatBooking),
    });
  } catch (error) {
    console.error("Get bookings error:", error);

    return res.status(500).json({
      error: "Unable to load bookings.",
    });
  }
}

async function createBooking(req, res) {
  const client = await pool.connect();

  try {
    if (req.user?.role !== "student") {
      return res.status(403).json({
        error: "Only students can request bookings.",
      });
    }

    const {
      tutorID,
      slotID,
      subjectID,
      date,
      startTime,
      duration,
      note = "",
    } = req.body || {};

    const durationMinutes = Number(duration);

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

    await client.query("BEGIN");

    const tutorResult = await client.query(
      `SELECT
         tp.id AS profile_id,
         tp.user_id,
         tp.subject
       FROM public.tutor_profiles tp
       JOIN public.users u ON u.id = tp.user_id
       WHERE tp.id = $1
         AND u.role = 'tutor'
       LIMIT 1`,
      [tutorID]
    );

    if (!tutorResult.rows.length) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Tutor not found.",
      });
    }

    const tutor = tutorResult.rows[0];

    const tutorSubjects = String(tutor.subject || "")
      .split(",")
      .map((subject) => subject.trim())
      .filter(Boolean);

    if (!tutorSubjects.includes(String(subjectID))) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "This tutor does not offer that subject.",
      });
    }

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

    if (!slotResult.rows.length) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error: "This time slot is no longer available.",
      });
    }

    const slot = slotResult.rows[0];

    const toMinutes = (value) => {
      const [hours, minutes] = String(value)
        .split(":")
        .map(Number);

      return hours * 60 + minutes;
    };

    const startMinutes = toMinutes(slot.start_time);
    const endMinutes = toMinutes(slot.end_time);

    if (startMinutes + durationMinutes > endMinutes) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error:
          "The selected slot is too short for this duration.",
      });
    }

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

    if (conflict.rows.length) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error:
          "This tutor already has a booking at that time.",
      });
    }

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
          status
        )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING *`,
      [
        req.user.userId,
        tutor.user_id,
        date,
        startTime,
        durationMinutes,
        String(subjectID),
        note.trim(),
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Booking request submitted.",
      booking: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Create booking error:", error);

    return res.status(500).json({
      error: "Unable to create booking.",
    });
  } finally {
    client.release();
  }
}

async function updateBookingStatus(req, res) {
  const client = await pool.connect();

  try {
    const { userId, role } = req.user;
    const { status } = req.body || {};

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

    await client.query("BEGIN");

    const result = await client.query(
      `SELECT *
       FROM public.bookings
       WHERE id = $1
       FOR UPDATE`,
      [req.params.id]
    );

    if (!result.rows.length) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Booking not found.",
      });
    }

    const booking = result.rows[0];

    const isStudent =
      role === "student" &&
      String(booking.student_id) === String(userId);

    const isTutor =
      role === "tutor" &&
      String(booking.tutor_id) === String(userId);

    if (!isStudent && !isTutor) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        error: "You cannot update this booking.",
      });
    }

    let allowed = false;

    if (isStudent) {
      allowed =
        ["pending", "accepted"].includes(
          booking.status
        ) && status === "cancelled";
    }

    if (isTutor) {
      allowed =
        (booking.status === "pending" &&
          ["accepted", "declined"].includes(status)) ||
        (booking.status === "accepted" &&
          status === "completed");
    }

    if (!allowed) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "That status change is not allowed.",
      });
    }

    const updated = await client.query(
      `UPDATE public.bookings
       SET status = $1
       WHERE id = $2
       RETURNING *`,
      [status, booking.id]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Booking updated successfully.",
      booking: formatBooking(updated.rows[0]),
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Update booking error:", error);

    return res.status(500).json({
      error: "Unable to update booking.",
    });
  } finally {
    client.release();
  }
}

module.exports = {
  getBookings,
  createBooking,
  updateBookingStatus,
};
