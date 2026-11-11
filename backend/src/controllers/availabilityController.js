
const pool = require("../config/db");

function isValidDate(value) {
  if (typeof value !== "string") return false;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
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

function normalizeTime(value) {
  return value.slice(0, 5);
}

function formatSlot(row) {
  return {
    id: String(row.id),
    tutorId: String(row.tutor_id),
    date: row.available_date,
    startTime: normalizeTime(row.start_time),
    endTime: normalizeTime(row.end_time),
    isAvailable: row.is_available,
  };
}

async function hasTutorProfile(userId) {
  const result = await pool.query(
    `SELECT 1
     FROM public.tutor_profiles
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );

  return result.rowCount > 0;
}

async function getMyAvailability(req, res) {
  try {
    if (req.user?.role !== "tutor") {
      return res.status(403).json({
        error: "Tutor access required.",
      });
    }

    const result = await pool.query(
      `SELECT *
       FROM public.tutor_availability
       WHERE tutor_id = $1
       ORDER BY available_date, start_time`,
      [req.user.userId]
    );

    return res.json({
      success: true,
      availability: result.rows.map(formatSlot),
    });
  } catch (error) {
    console.error("Get availability error:", error);

    return res.status(500).json({
      error: "Unable to load availability.",
    });
  }
}

async function createAvailability(req, res) {
  try {
    if (req.user?.role !== "tutor") {
      return res.status(403).json({
        error: "Tutor access required.",
      });
    }

    const userId = req.user.userId;

    if (!(await hasTutorProfile(userId))) {
      return res.status(400).json({
        error:
          "Complete your tutor profile before adding availability.",
      });
    }

    const {
      date,
      startTime,
      endTime,
      isAvailable = true,
    } = req.body || {};

    if (
      !isValidDate(date) ||
      !isValidTime(startTime) ||
      !isValidTime(endTime) ||
      normalizeTime(startTime) >= normalizeTime(endTime) ||
      typeof isAvailable !== "boolean"
    ) {
      return res.status(400).json({
        error: "Invalid availability information.",
      });
    }

    const result = await pool.query(
      `INSERT INTO public.tutor_availability
        (
          tutor_id,
          available_date,
          start_time,
          end_time,
          is_available
        )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        userId,
        date,
        startTime,
        endTime,
        isAvailable,
      ]
    );

    return res.status(201).json({
      success: true,
      availability: formatSlot(result.rows[0]),
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        error: "This availability slot already exists.",
      });
    }

    console.error("Create availability error:", error);

    return res.status(500).json({
      error: "Unable to create availability.",
    });
  }
}

async function updateAvailability(req, res) {
  try {
    if (req.user?.role !== "tutor") {
      return res.status(403).json({
        error: "Tutor access required.",
      });
    }

    const {
      date,
      startTime,
      endTime,
      isAvailable,
    } = req.body || {};

    if (
      !isValidDate(date) ||
      !isValidTime(startTime) ||
      !isValidTime(endTime) ||
      normalizeTime(startTime) >= normalizeTime(endTime) ||
      typeof isAvailable !== "boolean"
    ) {
      return res.status(400).json({
        error: "Invalid availability information.",
      });
    }

    const result = await pool.query(
      `UPDATE public.tutor_availability
       SET
         available_date = $1,
         start_time = $2,
         end_time = $3,
         is_available = $4
       WHERE id = $5
         AND tutor_id = $6
       RETURNING *`,
      [
        date,
        startTime,
        endTime,
        isAvailable,
        req.params.id,
        req.user.userId,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: "Availability slot not found.",
      });
    }

    return res.json({
      success: true,
      availability: formatSlot(result.rows[0]),
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        error: "This availability slot already exists.",
      });
    }

    console.error("Update availability error:", error);

    return res.status(500).json({
      error: "Unable to update availability.",
    });
  }
}

async function deleteAvailability(req, res) {
  try {
    if (req.user?.role !== "tutor") {
      return res.status(403).json({
        error: "Tutor access required.",
      });
    }

    const result = await pool.query(
      `DELETE FROM public.tutor_availability
       WHERE id = $1
         AND tutor_id = $2
       RETURNING id`,
      [req.params.id, req.user.userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: "Availability slot not found.",
      });
    }

    return res.json({
      success: true,
      message: "Availability deleted successfully.",
    });
  } catch (error) {
    console.error("Delete availability error:", error);

    return res.status(500).json({
      error: "Unable to delete availability.",
    });
  }
}

async function getTutorAvailability(req, res) {
  try {
    const tutorId = req.params.tutorId;

    const result = await pool.query(
      `SELECT
         a.id,
         a.tutor_id,
         a.available_date,
         a.start_time,
         a.end_time,
         a.is_available
       FROM public.tutor_availability a
       JOIN public.tutor_profiles tp
         ON tp.user_id = a.tutor_id
       WHERE a.tutor_id = $1
         AND a.is_available = TRUE
         AND (
           a.available_date > CURRENT_DATE
           OR (
             a.available_date = CURRENT_DATE
             AND a.end_time > LOCALTIME
           )
         )
       ORDER BY a.available_date, a.start_time`,
      [tutorId]
    );

    return res.json({
      success: true,
      availability: result.rows.map(formatSlot),
    });
  } catch (error) {
    console.error("Public availability error:", error);

    return res.status(500).json({
      error: "Unable to load tutor availability.",
    });
  }
}

module.exports = {
  getMyAvailability,
  createAvailability,
  updateAvailability,
  deleteAvailability,
  getTutorAvailability,
};
