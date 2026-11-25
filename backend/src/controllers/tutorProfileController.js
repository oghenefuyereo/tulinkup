// Import the database connection to manage tutor profiles.
const pool = require("../config/db");

// Import the platform pricing configuration.
const {
  getPricingConfig,
  validatePrivatePricing,
} = require("../utils/pricing");

// Validate and convert an hourly rate into cents.
function getHourlyRateCents(value, pricing) {
  if (
    value == null ||
    !["number", "string"].includes(typeof value) ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const rate = Number(value);

  if (
    !Number.isFinite(rate) ||
    rate < pricing.MIN_PRIVATE_HOURLY_RATE_CENTS / 100 ||
    rate > pricing.MAX_PRIVATE_HOURLY_RATE_CENTS / 100
  ) {
    return null;
  }

  const cents = Math.round(rate * 100);

  if (Math.abs(rate * 100 - cents) > 0.000001) {
    return null;
  }

  try {
    validatePrivatePricing(cents, pricing);

    return cents;
  } catch {
    return null;
  }
}

// Prepare the hourly rate validation message.
function getHourlyRateError(pricing) {
  const minimum =
    pricing.MIN_PRIVATE_HOURLY_RATE_CENTS / 100;

  const maximum =
    pricing.MAX_PRIVATE_HOURLY_RATE_CENTS / 100;

  return `Hourly rate must be between $${minimum} and $${maximum} ${pricing.CURRENCY} with a maximum of two decimal places.`;
}

// Prepare tutor pricing information for the frontend.
function formatTutorPricing(tutor, pricing) {
  const hourlyRateCents = getHourlyRateCents(
    tutor.hourly_rate,
    pricing
  );

  const hourlyRate =
    hourlyRateCents === null
      ? null
      : hourlyRateCents / 100;

  return {
    ...tutor,
    hourly_rate: hourlyRate,
    hourlyRate,
    hourlyRateCents,
    currency: pricing.CURRENCY,
    isFree: hourlyRateCents === 0,
  };
}

// Get all tutor profiles, including the subjects they teach.
const getTutorProfiles = async (req, res) => {
  res.set("Cache-Control", "no-store");

  try {
    // Retrieve the current platform pricing rules.
    const pricing = await getPricingConfig();

    // Get tutor details and combine each tutor's subjects into a list.
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
      JOIN public.users u
        ON u.id = tp.user_id
      LEFT JOIN public.tutor_subjects ts
        ON ts.tutor_profile_id = tp.id
      LEFT JOIN public.subjects s
        ON s.id = ts.subject_id
      WHERE u.role = 'tutor'
        AND u.account_status = 'active'
        AND tp.approval_status = 'approved'
      GROUP BY tp.id
      ORDER BY tp.featured DESC, tp.rating DESC, tp.id DESC
    `);

    // Format the pricing information for each tutor.
    const tutors = result.rows.map((tutor) =>
      formatTutorPricing(tutor, pricing)
    );

    // Send the tutor profiles back to the frontend.
    return res.json({
      success: true,
      tutors,
    });
  } catch (error) {
    // Log any errors that happen while loading tutor profiles.
    console.error(
      "Get tutor profiles error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Unable to load tutor profiles",
    });
  }
};

// Get a specific tutor profile using its unique URL slug.
const getTutorProfileBySlug = async (req, res) => {
  res.set("Cache-Control", "no-store");

  try {
    // Search for the tutor profile using the slug from the URL.
    const result = await pool.query(
      `SELECT tp.*
       FROM public.tutor_profiles tp
       JOIN public.users u
         ON u.id = tp.user_id
       WHERE tp.slug = $1
         AND u.role = 'tutor'
         AND u.account_status = 'active'
         AND tp.approval_status = 'approved'`,
      [req.params.slug]
    );

    // Return an error if the tutor profile does not exist.
    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Tutor profile not found",
      });
    }

    // Retrieve the current platform pricing rules.
    const pricing = await getPricingConfig();

    // Prepare the tutor's profile and pricing information.
    const tutor = formatTutorPricing(
      result.rows[0],
      pricing
    );

    // Send the tutor's profile information to the frontend.
    return res.json({
      success: true,
      tutor,
    });
  } catch (error) {
    // Log any errors that happen while retrieving the tutor profile.
    console.error(
      "Get tutor profile error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Unable to load tutor profile",
    });
  }
};

// Allow a tutor to create a profile with their professional details.
const createTutorProfile = async (req, res) => {
  let client;
  let transactionStarted = false;

  try {
    // Only registered tutors can create tutor profiles.
    if (
      !req.user?.userId ||
      req.user?.role !== "tutor"
    ) {
      return res.status(403).json({
        success: false,
        message: "Only tutors can create tutor profiles",
      });
    }

    // Get the tutor's information from the submitted form.
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
    } = req.body || {};

    // Make sure all required profile fields are completed.
    const requiredFields = [
      displayName,
      slug,
      title,
      location,
      biography,
      qualifications,
      experience,
    ];

    if (
      requiredFields.some(
        (value) =>
          typeof value !== "string" ||
          !value.trim()
      ) ||
      !Array.isArray(subjectIds) ||
      subjectIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Complete all required tutor profile fields",
      });
    }

    // Get a database connection to save the profile and its subjects.
    client = await pool.connect();

    // Start a transaction so the profile and subjects are saved together.
    await client.query("BEGIN");
    transactionStarted = true;

    // Retrieve the current platform pricing rules.
    const pricing = await getPricingConfig(client);

    // Validate the tutor's hourly rate.
    const hourlyRateCents = getHourlyRateCents(
      hourlyRate,
      pricing
    );

    if (hourlyRateCents === null) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: getHourlyRateError(pricing),
      });
    }

    // Convert the validated amount into dollars for the database.
    const normalizedHourlyRate = (
      hourlyRateCents / 100
    ).toFixed(2);

    // Save the tutor's main profile information in the database.
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
        normalizedHourlyRate,
      ]
    );

    // Get the newly created tutor profile.
    const tutor = result.rows[0];

    // Save each selected subject without adding duplicates.
    for (const subjectId of [...new Set(subjectIds)]) {
      await client.query(
        `INSERT INTO public.tutor_subjects
         (tutor_profile_id, subject_id)
         VALUES ($1, $2)`,
        [tutor.id, subjectId]
      );
    }

    // Save the transaction once the profile and subjects are added.
    await client.query("COMMIT");
    transactionStarted = false;

    // Confirm that the tutor profile was created successfully.
    return res.status(201).json({
      success: true,
      tutor: formatTutorPricing(tutor, pricing),
    });
  } catch (error) {
    // Undo the changes if something goes wrong.
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Tutor profile rollback error:",
          rollbackError.message
        );
      }
    }

    console.error(
      "Create tutor profile error:",
      error.message
    );

    // Return a specific message if the profile or slug already exists.
    return res.status(
      error.code === "23505" ? 409 : 500
    ).json({
      success: false,
      message:
        error.code === "23505"
          ? "A tutor profile or slug already exists"
          : "Unable to create tutor profile",
    });
  } finally {
    // Release the database connection after the request is finished.
    if (client) {
      client.release();
    }
  }
};

// Allow tutors to update their existing profile information.
const updateTutorProfile = async (req, res) => {
  let client;
  let transactionStarted = false;

  try {
    // Only tutors are allowed to update tutor profiles.
    if (
      !req.user?.userId ||
      req.user?.role !== "tutor"
    ) {
      return res.status(403).json({
        success: false,
        message: "Only tutors can update tutor profiles",
      });
    }

    // Get the updated profile details from the request.
    const {
      displayName,
      title,
      location,
      biography,
      qualifications,
      experience,
      hourlyRate,
      availabilityStatus,
    } = req.body || {};

    // Validate the tutor's availability status when provided.
    const allowedAvailabilityStatuses = [
      "available",
      "appointment",
      "unavailable",
    ];

    if (
      availabilityStatus != null &&
      !allowedAvailabilityStatuses.includes(
        availabilityStatus
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid tutor availability status",
      });
    }

    // Get a database connection to update the tutor profile.
    client = await pool.connect();

    // Start a transaction for the profile update.
    await client.query("BEGIN");
    transactionStarted = true;

    // Retrieve the current platform pricing rules.
    const pricing = await getPricingConfig(client);

    // Validate the new hourly rate when one is provided.
    let normalizedHourlyRate = null;

    if (hourlyRate !== undefined) {
      const hourlyRateCents = getHourlyRateCents(
        hourlyRate,
        pricing
      );

      if (hourlyRateCents === null) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(400).json({
          success: false,
          message: getHourlyRateError(pricing),
        });
      }

      normalizedHourlyRate = (
        hourlyRateCents / 100
      ).toFixed(2);
    }

    // Update only the fields that have been provided.
    // Keep the existing values for fields that are not being changed.
    const result = await client.query(
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
        normalizedHourlyRate,
        availabilityStatus ?? null,
        req.params.id,
        req.user.userId,
      ]
    );

    // Return an error if the profile does not exist or belongs to another tutor.
    if (!result.rows.length) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(404).json({
        success: false,
        message: "Tutor profile not found or access denied",
      });
    }

    // Save the tutor profile changes.
    await client.query("COMMIT");
    transactionStarted = false;

    // Send the updated tutor profile back to the frontend.
    return res.json({
      success: true,
      tutor: formatTutorPricing(
        result.rows[0],
        pricing
      ),
    });
  } catch (error) {
    // Undo the changes if something goes wrong.
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Tutor profile rollback error:",
          rollbackError.message
        );
      }
    }

    // Log any errors that happen while updating the profile.
    console.error(
      "Update tutor profile error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Unable to update tutor profile",
    });
  } finally {
    // Release the database connection after the request is finished.
    if (client) {
      client.release();
    }
  }
};

// Allow tutors to delete their own profiles.
const deleteTutorProfile = async (req, res) => {
  try {
    // Make sure the logged-in user is a tutor.
    if (
      !req.user?.userId ||
      req.user?.role !== "tutor"
    ) {
      return res.status(403).json({
        success: false,
        message: "Only tutors can delete tutor profiles",
      });
    }

    // Delete the profile only if it belongs to the logged-in tutor.
    const result = await pool.query(
      `DELETE FROM public.tutor_profiles
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, req.user.userId]
    );

    // Return an error if the profile cannot be found.
    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Tutor profile not found or access denied",
      });
    }

    // Confirm that the tutor profile was deleted successfully.
    return res.json({
      success: true,
      message: "Tutor profile deleted successfully",
    });
  } catch (error) {
    // Log any errors that happen while deleting the tutor profile.
    console.error(
      "Delete tutor profile error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Unable to delete tutor profile",
    });
  }
};

// Export the functions so they can be used in the tutor profile routes.
module.exports = {
  getTutorProfiles,
  getTutorProfileBySlug,
  createTutorProfile,
  updateTutorProfile,
  deleteTutorProfile,
};