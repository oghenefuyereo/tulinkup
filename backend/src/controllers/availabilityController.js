
// Import the database connection so we can manage tutor availability.
const pool = require("../config/db");

// Check that a date is real and follows the YYYY-MM-DD format.
function isValidDate(value) {
  if (typeof value !== "string") return false;

  // Make sure the date follows the correct format.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  // Reject invalid dates, including dates that do not exist.
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

// Check that the time is written in a valid 24-hour format.
function isValidTime(value) {
  return (
    typeof value === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value)
  );
}

// Keep only the hours and minutes from a time value.
function normalizeTime(value) {
  return value.slice(0, 5);
}

// Format a database record into an availability object for the frontend.
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

// Check whether a tutor has already created a profile.
async function hasTutorProfile(userId) {
  const result = await pool.query(
    `SELECT 1
     FROM public.tutor_profiles
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );

  // Return true if a matching tutor profile exists.
  return result.rowCount > 0;
}

// Get all availability slots created by the logged-in tutor.
async function getMyAvailability(req, res) {
  try {
    // Only tutors should be able to access their availability dashboard.
    if (req.user?.role !== "tutor") {
      return res.status(403).json({
        error: "Tutor access required.",
      });
    }

    // Find the tutor's availability and sort it by date and time.
    const result = await pool.query(
      `SELECT *
       FROM public.tutor_availability
       WHERE tutor_id = $1
       ORDER BY available_date, start_time`,
      [req.user.userId]
    );

    // Format the records before sending them to the frontend.
    return res.json({
      success: true,
      availability: result.rows.map(formatSlot),
    });
  } catch (error) {
    // Log the error if the availability cannot be loaded.
    console.error("Get availability error:", error);

    return res.status(500).json({
      error: "Unable to load availability.",
    });
  }
}

// Allow a tutor to add a new available date and time.
async function createAvailability(req, res) {
  try {
    // Make sure the logged-in user is a tutor.
    if (req.user?.role !== "tutor") {
      return res.status(403).json({
        error: "Tutor access required.",
      });
    }

    const userId = req.user.userId;

    // Tutors must complete their profiles before adding availability.
    if (!(await hasTutorProfile(userId))) {
      return res.status(400).json({
        error:
          "Complete your tutor profile before adding availability.",
      });
    }

    // Get the availability details submitted by the tutor.
    const {
      date,
      startTime,
      endTime,
      isAvailable = true,
    } = req.body || {};

    // Check that the date, times, and availability status are valid.
    // The starting time must also be earlier than the ending time.
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

    // Save the new availability slot in the database.
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

    // Return the newly created availability to the frontend.
    return res.status(201).json({
      success: true,
      availability: formatSlot(result.rows[0]),
    });
  } catch (error) {
    // Handle cases where the same availability slot already exists.
    if (error.code === "23505") {
      return res.status(409).json({
        error: "This availability slot already exists.",
      });
    }

    // Handle other errors that happen while saving availability.
    console.error("Create availability error:", error);

    return res.status(500).json({
      error: "Unable to create availability.",
    });
  }
}

// Allow a tutor to make changes to an existing availability slot.
async function updateAvailability(req, res) {
  try {
    // Prevent users who are not tutors from updating availability.
    if (req.user?.role !== "tutor") {
      return res.status(403).json({
        error: "Tutor access required.",
      });
    }

    // Get the updated availability details from the request.
    const {
      date,
      startTime,
      endTime,
      isAvailable,
    } = req.body || {};

    // Validate the updated date, times, and availability status.
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

    // Update the slot only if it belongs to the logged-in tutor.
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

    // Return an error if the slot was not found.
    if (!result.rows.length) {
      return res.status(404).json({
        error: "Availability slot not found.",
      });
    }

    // Send the updated availability back to the frontend.
    return res.json({
      success: true,
      availability: formatSlot(result.rows[0]),
    });
  } catch (error) {
    // Handle duplicate availability slots.
    if (error.code === "23505") {
      return res.status(409).json({
        error: "This availability slot already exists.",
      });
    }

    // Log any other errors that happen during the update.
    console.error("Update availability error:", error);

    return res.status(500).json({
      error: "Unable to update availability.",
    });
  }
}

// Allow a tutor to remove an availability slot.
async function deleteAvailability(req, res) {
  try {
    // Only tutors can delete their availability.
    if (req.user?.role !== "tutor") {
      return res.status(403).json({
        error: "Tutor access required.",
      });
    }

    // Delete the slot only if it belongs to the logged-in tutor.
    const result = await pool.query(
      `DELETE FROM public.tutor_availability
       WHERE id = $1
         AND tutor_id = $2
       RETURNING id`,
      [req.params.id, req.user.userId]
    );

    // Return an error if the slot does not exist or is not owned by the tutor.
    if (!result.rows.length) {
      return res.status(404).json({
        error: "Availability slot not found.",
      });
    }

    // Confirm that the availability slot was deleted.
    return res.json({
      success: true,
      message: "Availability deleted successfully.",
    });
  } catch (error) {
    // Log any errors that happen while deleting availability.
    console.error("Delete availability error:", error);

    return res.status(500).json({
      error: "Unable to delete availability.",
    });
  }
}

// Get a tutor's available time slots for students to view.
async function getTutorAvailability(req, res) {
  try {
    // Get the tutor's ID from the URL.
    const tutorId = req.params.tutorId;

    // Find available slots that have not already passed.
    // Only include tutors who have a profile.
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

    // Send the tutor's available dates and times to the frontend.
    return res.json({
      success: true,
      availability: result.rows.map(formatSlot),
    });
  } catch (error) {
    // Log any errors while loading the tutor's public availability.
    console.error("Public availability error:", error);

    return res.status(500).json({
      error: "Unable to load tutor availability.",
    });
  }
}

// Export the functions so they can be used in the availability routes.
module.exports = {
  getMyAvailability,
  createAvailability,
  updateAvailability,
  deleteAvailability,
  getTutorAvailability,
};
