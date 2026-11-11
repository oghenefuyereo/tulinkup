
const pool = require("../config/db");

async function updateProfile(req, res) {
  const userId = req.user?.userId;
  const role = req.user?.role;

  if (!userId || !["student", "tutor"].includes(role)) {
    return res.status(403).json({
      error: "Access denied.",
    });
  }

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

  let normalizedSubjects = [];

  if (role === "tutor") {
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

    normalizedSubjects = subjects
      .filter(
        (subject) =>
          typeof subject === "string" &&
          subject.trim().length > 0
      )
      .map((subject) => subject.trim());

    if (
      normalizedSubjects.length === 0 ||
      normalizedSubjects.join(", ").length > 150
    ) {
      return res.status(400).json({
        error: "Choose valid subjects.",
      });
    }
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const updatedUser = await client.query(
      `UPDATE public.users
       SET full_name = $1, phone = $2
       WHERE id = $3 AND role = $4
       RETURNING id, full_name, email, phone, role`,
      [fullName.trim(), phone.trim(), userId, role]
    );

    if (updatedUser.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Account not found.",
      });
    }

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

    await client.query("COMMIT");

    return res.json({
      success: true,
      user: updatedUser.rows[0],
      message: "Profile updated successfully.",
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Profile update error:", error);

    return res.status(500).json({
      error: "Unable to update profile.",
    });
  } finally {
    client.release();
  }
}

module.exports = {
  updateProfile,
};
