
// Import the database connection to update student and tutor profiles.
const pool = require("../config/db");

// Allow logged-in students and tutors to update their profile information.
async function updateProfile(req, res) {
  // Get the user's ID and role from their authentication details.
  const userId = req.user?.userId;
  const role = req.user?.role;

  // Only students and tutors are allowed to update their profiles.
  if (!userId || !["student", "tutor"].includes(role)) {
    return res.status(403).json({
      error: "Access denied.",
    });
  }

  // Get the profile information submitted by the user.
  const {
    fullName,
    phone = "",
    title,
    location,
    biography,
    qualifications,
    experience,
    hourlyRate,
    subjects,
  } = req.body || {};

  // Make sure the user's name and phone number meet the requirements.
  if (
    typeof fullName !== "string" ||
    fullName.trim().length < 2 ||
    fullName.trim().length > 100 ||
    typeof phone !== "string" ||
    phone.length > 30
  ) {
    return res.status(400).json({
      error: "Enter valid personal information.",
    });
  }

  // Create an empty list to store the tutor's selected subjects.
  let normalizedSubjects = [];

  // Tutors need to provide additional information about their services.
  if (role === "tutor") {
    // Check that all required tutor details are complete and valid.
    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.length > 120 ||
      typeof location !== "string" ||
      !location.trim() ||
      location.length > 120 ||
      typeof biography !== "string" ||
      biography.trim().length < 20 ||
      biography.length > 1500 ||
      typeof qualifications !== "string" ||
      !qualifications.trim() ||
      qualifications.length > 1000 ||
      typeof experience !== "string" ||
      !experience.trim() ||
      experience.length > 1000 ||
      !Array.isArray(subjects) ||
      subjects.length < 1 ||
      typeof hourlyRate !== "number" ||
      !Number.isFinite(hourlyRate) ||
      hourlyRate < 10 ||
      hourlyRate > 500
    ) {
      return res.status(400).json({
        error:
          "Complete all tutor fields and choose at least one subject.",
      });
    }

    // Remove empty subjects and extra spaces from the selected subjects.
    normalizedSubjects = subjects
      .filter(
        (subject) =>
          typeof subject === "string" &&
          subject.trim().length > 0
      )
      .map((subject) => subject.trim());

    // Make sure the tutor has selected at least one valid subject.
    if (
      normalizedSubjects.length === 0 ||
      normalizedSubjects.join(", ").length > 150
    ) {
      return res.status(400).json({
        error: "Choose valid subjects.",
      });
    }
  }

  // Get a database connection to save the profile changes.
  const client = await pool.connect();

  try {
    // Start a transaction so the profile updates are saved together.
    await client.query("BEGIN");

    // Update the user's name and phone number in the users table.
    const updatedUser = await client.query(
      `UPDATE public.users
       SET full_name = $1, phone = $2
       WHERE id = $3 AND role = $4
       RETURNING id, full_name, email, phone, role`,
      [fullName.trim(), phone.trim(), userId, role]
    );

    // Stop if the user's account cannot be found.
    if (updatedUser.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Account not found.",
      });
    }

    // Save the tutor's professional information if the user is a tutor.
    if (role === "tutor") {
      await client.query(
        `INSERT INTO public.tutor_profiles
          (
            user_id,
            title,
            location,
            bio,
            qualifications,
            experience,
            hourly_rate,
            subject
          )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id)
         DO UPDATE SET
           title = EXCLUDED.title,
           location = EXCLUDED.location,
           bio = EXCLUDED.bio,
           qualifications = EXCLUDED.qualifications,
           experience = EXCLUDED.experience,
           hourly_rate = EXCLUDED.hourly_rate,
           subject = EXCLUDED.subject`,
        [
          userId,
          title.trim(),
          location.trim(),
          biography.trim(),
          qualifications.trim(),
          experience.trim(),
          hourlyRate,
          normalizedSubjects.join(", "),
        ]
      );
    }

    // Save all changes once the updates are successful.
    await client.query("COMMIT");

    // Let the frontend know the profile was updated successfully.
    return res.json({
      success: true,
      user: updatedUser.rows[0],
      message: "Profile updated successfully.",
    });
  } catch (error) {
    // Undo the changes if an error happens during the update.
    await client.query("ROLLBACK");

    // Log the error to help identify what went wrong.
    console.error("Profile update error:", error);

    return res.status(500).json({
      error: "Unable to update profile.",
    });
  } finally {
    // Release the database connection after the request is finished.
    client.release();
  }
}

// Export the function so it can be used in the profile routes.
module.exports = {
  updateProfile,
};
