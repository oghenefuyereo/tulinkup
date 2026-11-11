
const pool = require("../config/db");

const getTutorProfiles = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        tp.id,
        tp.user_id,
        tp.display_name,
        tp.slug,
        tp.title,
        tp.location,
        tp.biography,
        tp.qualifications,
        tp.experience,
        tp.hourly_rate,
        tp.rating,
        tp.review_count,
        tp.availability_status,
        tp.featured,
        tp.profile_image_url,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', s.id,
              'name', s.name,
              'slug', s.slug
            )
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'::json
        ) AS subjects
      FROM public.tutor_profiles tp
      LEFT JOIN public.tutor_subjects ts
        ON ts.tutor_profile_id = tp.id
      LEFT JOIN public.subjects s
        ON s.id = ts.subject_id
      GROUP BY tp.id
      ORDER BY tp.featured DESC, tp.rating DESC, tp.id DESC
    `);

    res.json({
      success: true,
      tutors: result.rows,
    });
  } catch (error) {
    console.error("Get tutor profiles error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to load tutor profiles",
    });
  }
};

const getTutorProfileBySlug = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM public.tutor_profiles
       WHERE slug = $1`,
      [req.params.slug]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Tutor profile not found",
      });
    }

    res.json({
      success: true,
      tutor: result.rows[0],
    });
  } catch (error) {
    console.error("Get tutor profile error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to load tutor profile",
    });
  }
};

const createTutorProfile = async (req, res) => {
  const client = await pool.connect();

  try {
    if (req.user.role !== "tutor") {
      return res.status(403).json({
        success: false,
        message: "Only tutors can create tutor profiles",
      });
    }

    const {
      displayName,
      slug,
      title,
      location,
      biography,
      qualifications,
      experience,
      hourlyRate,
      subjectIds,
    } = req.body;

    if (
      !displayName?.trim() ||
      !slug?.trim() ||
      !title?.trim() ||
      !location?.trim() ||
      !biography?.trim() ||
      !qualifications?.trim() ||
      !experience?.trim() ||
      !Number.isFinite(Number(hourlyRate)) ||
      Number(hourlyRate) < 10 ||
      Number(hourlyRate) > 500 ||
      !Array.isArray(subjectIds) ||
      subjectIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Complete all required tutor profile fields",
      });
    }

    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO public.tutor_profiles (
        user_id,
        display_name,
        slug,
        title,
        location,
        biography,
        qualifications,
        experience,
        hourly_rate
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
      [
        req.user.userId,
        displayName.trim(),
        slug.trim(),
        title.trim(),
        location.trim(),
        biography.trim(),
        qualifications.trim(),
        experience.trim(),
        Number(hourlyRate),
      ]
    );

    const tutor = result.rows[0];

    for (const subjectId of [...new Set(subjectIds)]) {
      await client.query(
        `INSERT INTO public.tutor_subjects
         (tutor_profile_id, subject_id)
         VALUES ($1, $2)`,
        [tutor.id, subjectId]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      tutor,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create tutor profile error:", error.message);

    res.status(error.code === "23505" ? 409 : 500).json({
      success: false,
      message:
        error.code === "23505"
          ? "A tutor profile or slug already exists"
          : "Unable to create tutor profile",
    });
  } finally {
    client.release();
  }
};

const updateTutorProfile = async (req, res) => {
  try {
    if (req.user.role !== "tutor") {
      return res.status(403).json({
        success: false,
        message: "Only tutors can update tutor profiles",
      });
    }

    const {
      displayName,
      title,
      location,
      biography,
      qualifications,
      experience,
      hourlyRate,
      availabilityStatus,
    } = req.body;

    const result = await pool.query(
      `UPDATE public.tutor_profiles
       SET display_name = COALESCE($1, display_name),
           title = COALESCE($2, title),
           location = COALESCE($3, location),
           biography = COALESCE($4, biography),
           qualifications = COALESCE($5, qualifications),
           experience = COALESCE($6, experience),
           hourly_rate = COALESCE($7, hourly_rate),
           availability_status = COALESCE($8, availability_status)
       WHERE id = $9 AND user_id = $10
       RETURNING *`,
      [
        displayName ?? null,
        title ?? null,
        location ?? null,
        biography ?? null,
        qualifications ?? null,
        experience ?? null,
        hourlyRate ?? null,
        availabilityStatus ?? null,
        req.params.id,
        req.user.userId,
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Tutor profile not found or access denied",
      });
    }

    res.json({
      success: true,
      tutor: result.rows[0],
    });
  } catch (error) {
    console.error("Update tutor profile error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to update tutor profile",
    });
  }
};

const deleteTutorProfile = async (req, res) => {
  try {
    if (req.user.role !== "tutor") {
      return res.status(403).json({
        success: false,
        message: "Only tutors can delete tutor profiles",
      });
    }

    const result = await pool.query(
      `DELETE FROM public.tutor_profiles
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, req.user.userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Tutor profile not found or access denied",
      });
    }

    res.json({
      success: true,
      message: "Tutor profile deleted successfully",
    });
  } catch (error) {
    console.error("Delete tutor profile error:", error.message);
    res.status(500).json({
      success: false,
      message: "Unable to delete tutor profile",
    });
  }
};

module.exports = {
  getTutorProfiles,
  getTutorProfileBySlug,
  createTutorProfile,
  updateTutorProfile,
  deleteTutorProfile,
};
