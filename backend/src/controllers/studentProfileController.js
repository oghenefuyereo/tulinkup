"use strict";

const pool = require("../config/db");

// Define the permitted student learning profile fields.
const FIELD_LIMITS = Object.freeze({
  displayName: 150,
  biography: 1500,
  learningInterests: 1000,
  education: 1000,
  learningGoals: 1000,
});

// Validate a complete student profile update.
function validateStudentProfile(body) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    throw new Error("Invalid profile information.");
  }

  const allowedFields = Object.keys(FIELD_LIMITS);

  const submittedFields = Object.keys(body);

  if (
    submittedFields.length !== allowedFields.length ||
    submittedFields.some(
      (field) => !allowedFields.includes(field)
    )
  ) {
    throw new Error(
      "Submit only the permitted student profile fields."
    );
  }

  const normalized = {};

  for (const [field, max] of Object.entries(FIELD_LIMITS)) {
    const value = body[field];

    if (typeof value !== "string") {
      throw new Error(
        `${field} must be text.`
      );
    }

    if (value.includes("\u0000")) {
      throw new Error(
        `${field} contains invalid characters.`
      );
    }

    const cleaned = value.trim();
    const length = Array.from(cleaned).length;

    if (length > max) {
      throw new Error(
        `${field} must not exceed ${max} characters.`
      );
    }

    normalized[field] = cleaned;
  }

  if (
    normalized.displayName &&
    Array.from(normalized.displayName).length < 2
  ) {
    throw new Error(
      "Display name must contain at least two characters."
    );
  }

  // An empty display name uses the account name as fallback.
  normalized.displayName =
    normalized.displayName || null;

  return normalized;
}

// Return only the student's permitted profile information.
function formatStudentProfile(row) {
  return {
    displayName: row.display_name || null,
    biography: row.biography || "",
    learningInterests: row.learning_interests || "",
    education: row.education || "",
    learningGoals: row.learning_goals || "",
    hasProfileImage: Boolean(row.profile_image_path),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

// Retrieve the authenticated student's learning profile.
async function getStudentProfile(req, res) {
  const userId = req.user?.userId;

  if (!userId || req.user?.role !== "student") {
    return res.status(403).json({
      success: false,
      error: "Student access required.",
    });
  }

  try {
    const result = await pool.query(
      `SELECT
         sp.display_name,
         sp.biography,
         sp.learning_interests,
         sp.education,
         sp.learning_goals,
         sp.profile_image_path,
         sp.created_at,
         sp.updated_at
       FROM public.users AS u
       LEFT JOIN public.student_profiles AS sp
         ON sp.user_id = u.id
       WHERE u.id = $1
         AND u.role = 'student'
         AND u.account_status = 'active'
       LIMIT 1`,
      [userId]
    );

    if (result.rowCount !== 1) {
      return res.status(403).json({
        success: false,
        error: "Student account unavailable.",
      });
    }

    return res.json({
      success: true,
      profile: formatStudentProfile(result.rows[0]),
    });

  } catch (error) {
    console.error("Student profile retrieval failed.");

    return res.status(500).json({
      success: false,
      error: "Unable to retrieve student profile.",
    });
  }
}

// Create or update the authenticated student's learning profile.
async function updateStudentProfile(req, res) {
  const userId = req.user?.userId;

  if (!userId || req.user?.role !== "student") {
    return res.status(403).json({
      success: false,
      error: "Student access required.",
    });
  }

  let profile;

  try {
    profile = validateStudentProfile(req.body);
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO public.student_profiles (
         user_id,
         display_name,
         biography,
         learning_interests,
         education,
         learning_goals
       )
       SELECT
         u.id,
         $2,
         $3,
         $4,
         $5,
         $6
       FROM public.users AS u
       WHERE u.id = $1
         AND u.role = 'student'
         AND u.account_status = 'active'
       ON CONFLICT (user_id)
       DO UPDATE SET
         display_name = EXCLUDED.display_name,
         biography = EXCLUDED.biography,
         learning_interests = EXCLUDED.learning_interests,
         education = EXCLUDED.education,
         learning_goals = EXCLUDED.learning_goals,
         updated_at = NOW()
       RETURNING
         display_name,
         biography,
         learning_interests,
         education,
         learning_goals,
         profile_image_path,
         created_at,
         updated_at`,
      [
        userId,
        profile.displayName,
        profile.biography,
        profile.learningInterests,
        profile.education,
        profile.learningGoals,
      ]
    );

    if (result.rowCount !== 1) {
      return res.status(403).json({
        success: false,
        error: "Student account unavailable.",
      });
    }

    return res.json({
      success: true,
      message: "Student profile updated successfully.",
      profile: formatStudentProfile(result.rows[0]),
    });

  } catch (error) {
    console.error("Student profile update failed.");

    return res.status(500).json({
      success: false,
      error: "Unable to update student profile.",
    });
  }
}

module.exports = {
  validateStudentProfile,
  formatStudentProfile,
  getStudentProfile,
  updateStudentProfile,
};
