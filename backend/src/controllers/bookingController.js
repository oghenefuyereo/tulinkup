
const pool = require("../config/db");

const allowedDurations = new Set([30, 60, 90]);

function minutes(time) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function validDate(value) {
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function validTime(value) {
  return typeof value === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

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

  const tutorProfileId = String(tutorID ?? "");
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

  if (typeof note !== "undefined" &&
      typeof note !== "string") {
    return res.status(400).json({
      error: "Invalid booking note.",
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  if (date < today) {
    return res.status(400).json({
      error: "Cannot book a past date.",
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

    const profileResult = await client.query(
      `SELECT id, user_id, subject
       FROM public.tutor_profiles
       WHERE id = $1`,
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

    // Current schema stores one subject per tutor.
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

    // Serialize booking requests for this tutor and date.
    await client.query(
      `SELECT pg_advisory_xact_lock(
        hashtext($1),
        hashtext($2)
      )`,
      [String(profile.user_id), date]
    );

    const availabilityResult = await client.query(
      `SELECT id
       FROM public.tutor_availability
       WHERE tutor_id = $1
         AND available_date = $2::date
         AND start_time <= $3::time
         AND end_time >=
           ($3::time + ($4::integer * INTERVAL '1 minute'))
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

    const conflictResult = await client.query(
      `SELECT id
       FROM public.bookings
       WHERE tutor_id = $1
         AND booking_date = $2::date
         AND status IN ('pending', 'accepted')
         AND booking_time <
           ($3::time + ($4::integer * INTERVAL '1 minute'))
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
      VALUES ($1, $2, $3::date, $4::time, $5, $6, 'pending')
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

module.exports = { createBooking };
