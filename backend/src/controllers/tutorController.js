
const pool = require("../config/db");

async function getMyTutorProfile(req, res) {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;

    if (!userId || role !== "tutor") {
      return res.status(403).json({
        error: "Tutor access required.",
      });
    }

    const result = await pool.query(
      `SELECT
         id,
         user_id,
         bio,
         subject,
         experience,
         hourly_rate
       FROM public.tutor_profiles
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Tutor profile not found.",
      });
    }

    return res.json({
      success: true,
      profile: result.rows[0],
    });
  } catch (error) {
    console.error("Tutor profile error:", error);

    return res.status(500).json({
      error: "Unable to load tutor profile.",
    });
  }
}

module.exports = {
  getMyTutorProfile,
};