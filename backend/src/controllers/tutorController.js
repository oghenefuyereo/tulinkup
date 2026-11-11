
const pool = require("../config/db");

function formatTutor(row) {
  const subjects = String(row.subject || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ id: name, name }));

  return {
    id: String(row.id),
    userId: String(row.user_id),
    slug: row.slug,
    name: row.full_name,
    title: row.title || "",
    location: row.location || "",
    biography: row.bio || "",
    qualifications: row.qualifications || "",
    experience: row.experience || "",
    hourlyRate: Number(row.hourly_rate || 0),
    subjects,
    image: row.profile_image_url
      ? {
          url: row.profile_image_url,
          alt: `${row.full_name}, tutor profile`,
        }
      : null,
    verified: false,
    rating: null,
    reviewCount: 0,
    availabilityStatus: "appointment",
  };
}

const tutorSelect = `
  SELECT
    tp.id,
    tp.user_id,
    tp.bio,
    tp.subject,
    tp.experience,
    tp.hourly_rate,
    tp.title,
    tp.location,
    tp.qualifications,
    tp.profile_image_url,
    u.full_name
  FROM public.tutor_profiles tp
  JOIN public.users u ON u.id = tp.user_id
  WHERE u.role = 'tutor'
`;

function makeSlug(fullName, userId) {
  const base = String(fullName || "tutor")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${base || "tutor"}-${userId}`;
}

async function getMyTutorProfile(req, res) {
  try {
    const userId = req.user?.userId;

    if (!userId || req.user?.role !== "tutor") {
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
        hourly_rate,
        title,
        location,
        qualifications,
        profile_image_url
       FROM public.tutor_profiles
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: "Tutor profile not found.",
      });
    }

    const row = result.rows[0];

    return res.json({
      success: true,
      profile: {
        ...row,
        biography: row.bio || "",
        hourlyRate: Number(row.hourly_rate || 0),
        subjects: String(row.subject || "")
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean)
          .map((name) => ({ id: name, name })),
      },
    });
  } catch (error) {
    console.error("Tutor profile error:", error);

    return res.status(500).json({
      error: "Unable to load tutor profile.",
    });
  }
}

async function getTutors(req, res) {
  try {
    const result = await pool.query(
      `${tutorSelect}
       ORDER BY u.full_name ASC
       LIMIT 100`
    );

    const tutors = result.rows.map((row) => ({
      ...formatTutor(row),
      slug: makeSlug(row.full_name, row.user_id),
    }));

    return res.json({ success: true, tutors });
  } catch (error) {
    console.error("Get tutors error:", error);

    return res.status(500).json({
      error: "Unable to load tutors.",
    });
  }
}

async function findTutorBySlug(slug) {
  const match = /^(.+)-([0-9]+)$/.exec(slug);

  if (!match) return null;

  const userId = match[2];

  const result = await pool.query(
    `${tutorSelect}
     AND tp.user_id = $1
     LIMIT 1`,
    [userId]
  );

  if (!result.rows.length) return null;

  const row = result.rows[0];
  const canonicalSlug = makeSlug(row.full_name, row.user_id);

  if (canonicalSlug !== slug) return null;

  return {
    ...formatTutor(row),
    slug: canonicalSlug,
  };
}

async function getTutorBySlug(req, res) {
  try {
    const tutor = await findTutorBySlug(req.params.slug);

    if (!tutor) {
      return res.status(404).json({
        error: "Tutor not found.",
      });
    }

    return res.json({
      success: true,
      tutor,
    });
  } catch (error) {
    console.error("Get tutor error:", error);

    return res.status(500).json({
      error: "Unable to load tutor.",
    });
  }
}

async function getTutorExtras(req, res) {
  try {
    const tutor = await findTutorBySlug(req.params.slug);

    if (!tutor) {
      return res.status(404).json({
        error: "Tutor not found.",
      });
    }

    // Reviews are not implemented in the current schema.
    const reviews = [];
    let availability = [];

    // Requires the tutor_availability migration.
    const result = await pool.query(
      `SELECT
        id,
        available_date AS date,
        start_time AS "startTime",
        end_time AS "endTime"
       FROM public.tutor_availability
       WHERE tutor_id = $1
         AND available_date >= CURRENT_DATE
       ORDER BY available_date, start_time
       LIMIT 20`,
      [tutor.userId]
    );

    availability = result.rows.map((slot) => ({
      ...slot,
      id: String(slot.id),
    }));

    return res.json({
      success: true,
      reviews,
      availability,
    });
  } catch (error) {
    console.error("Tutor extras error:", error);

    return res.status(500).json({
      error: "Unable to load tutor availability.",
    });
  }
}

module.exports = {
  getMyTutorProfile,
  getTutors,
  getTutorBySlug,
  getTutorExtras,
};
