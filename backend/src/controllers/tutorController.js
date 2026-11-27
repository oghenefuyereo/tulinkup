// Import the database connection to retrieve tutor information.
const pool = require("../config/db");

// Import the platform pricing configuration.
const {
  getPricingConfig,
  validatePrivatePricing,
} = require("../utils/pricing");

// Validate and convert the tutor's hourly rate into cents.
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

// Prepare the tutor's pricing information.
function formatPricing(value, pricing) {
  const hourlyRateCents = getHourlyRateCents(
    value,
    pricing
  );

  return {
    hourlyRate:
      hourlyRateCents === null
        ? null
        : hourlyRateCents / 100,

    hourlyRateCents,

    currency: pricing.CURRENCY,

    isFree: hourlyRateCents === 0,
  };
}

// Format tutor information so the frontend can display it easily.
function formatTutor(row, pricingConfig) {
  // Turn the tutor's subjects into a list of subject objects.
  const subjects = String(row.subject || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ id: name, name }));

  // Prepare the tutor's hourly pricing information.
  const pricing = formatPricing(
    row.hourly_rate,
    pricingConfig
  );

  // Organize the tutor's details into a consistent format.
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

    ...pricing,

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

// Reuse this database query when retrieving tutor profiles.
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
    AND u.account_status = 'active'
    AND tp.approval_status = 'approved'
`;

// Create a unique URL slug using the tutor's name and user ID.
const { makeSlug } = require("../utils/tutorSlug");

// Get the profile information of the currently logged-in tutor.
async function getMyTutorProfile(req, res) {

  res.set("Cache-Control", "private, no-store");
  try {
    // Get the tutor's ID from their authentication details.
    const userId = req.user?.userId;

    // Only tutors can access this endpoint.
    if (!userId || req.user?.role !== "tutor") {
      return res.status(403).json({
        error: "Tutor access required.",
      });
    }

    // Find the tutor's profile in the database.
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
        profile_image_url,
        slug,
        display_name,
        availability_status
       FROM public.tutor_profiles
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );

    // Return an error if the tutor has not created a profile.
    if (!result.rows.length) {
      return res.status(404).json({
        error: "Tutor profile not found.",
      });
    }

    // Get the tutor's information from the database result.
    const row = result.rows[0];

    // Retrieve the current platform pricing configuration.
    const pricingConfig = await getPricingConfig();

    // Prepare the tutor's hourly pricing information.
    const pricing = formatPricing(
      row.hourly_rate,
      pricingConfig
    );

    // Load the authenticated tutor's own upcoming
    // available times independently of public approval.
    let availability = null;

    try {
      const slots = await pool.query(
        `SELECT
          a.id,
          a.available_date::text AS date,
          a.start_time AS "startTime",
          a.end_time AS "endTime"
         FROM public.tutor_availability a
         JOIN public.users u
           ON u.id = a.tutor_id
         WHERE a.tutor_id = $1
           AND u.role = 'tutor'
           AND u.account_status = 'active'
           AND a.is_available = TRUE
           AND (
             a.available_date > CURRENT_DATE
             OR (
               a.available_date = CURRENT_DATE
               AND a.end_time > LOCALTIME
             )
           )
         ORDER BY a.available_date, a.start_time, a.id`,
        [userId]
      );

      availability = slots.rows.map((slot) => ({
        ...slot,
        id: String(slot.id),
      }));
    } catch {
      // Distinguish an unavailable schedule from
      // a successfully loaded empty schedule.
      console.error("Unable to load private tutor availability.");
    }

    // Return the profile with formatted subjects and pricing.
    return res.json({
      success: true,
      availability,
      profile: {
        ...row,

        biography: row.bio || "",

        ...pricing,

        // Keep both hourly rate fields consistent.
        hourly_rate: pricing.hourlyRate,

        subjects: String(row.subject || "")
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean)
          .map((name) => ({ id: name, name })),
      },
    });
  } catch (error) {
    // Log any errors that happen while loading the tutor's profile.
    console.error("Tutor profile error:", error);

    return res.status(500).json({
      error: "Unable to load tutor profile.",
    });
  }
}

// Get a list of tutor profiles for the platform.
async function getTutors(req, res) {
  res.set("Cache-Control", "no-store");

  try {
    // Retrieve up to 100 tutors, sorted alphabetically by name.
    const result = await pool.query(
      `${tutorSelect}
       ORDER BY u.full_name ASC
       LIMIT 100`
    );

    // Retrieve the current platform pricing configuration.
    const pricingConfig = await getPricingConfig();

    // Format each tutor's details and create a unique profile URL.
    const tutors = result.rows.map((row) => ({
      ...formatTutor(row, pricingConfig),
      slug: makeSlug(row.full_name, row.user_id),
    }));

    // Send the tutor list back to the frontend.
    return res.json({
      success: true,
      tutors,
    });
  } catch (error) {
    // Log any errors that happen while retrieving tutors.
    console.error("Get tutors error:", error);

    return res.status(500).json({
      error: "Unable to load tutors.",
    });
  }
}

// Find a specific tutor using their profile URL slug.
async function findTutorBySlug(slug) {
  // Extract the tutor's user ID from the end of the slug.
  const match = /^(.+)-([0-9]+)$/.exec(slug);

  // Stop if the slug does not follow the expected format.
  if (!match) return null;

  const userId = match[2];

  // Search for the tutor using the extracted user ID.
  const result = await pool.query(
    `${tutorSelect}
     AND tp.user_id = $1
     LIMIT 1`,
    [userId]
  );

  // Return null if no matching tutor is found.
  if (!result.rows.length) return null;

  const row = result.rows[0];

  // Generate the correct slug using the tutor's current name.
  const canonicalSlug = makeSlug(
    row.full_name,
    row.user_id
  );

  // Reject the request if the slug does not match the tutor's current URL.
  if (canonicalSlug !== slug) return null;

  // Retrieve the current platform pricing configuration.
  const pricingConfig = await getPricingConfig();

  // Return the tutor's formatted profile information.
  return {
    ...formatTutor(row, pricingConfig),
    slug: canonicalSlug,
  };
}

// Get a tutor's public profile using their URL slug.
async function getTutorBySlug(req, res) {
  res.set("Cache-Control", "no-store");

  try {
    // Find the tutor using the slug provided in the URL.
    const tutor = await findTutorBySlug(
      req.params.slug
    );

    // Return an error if the tutor cannot be found.
    if (!tutor) {
      return res.status(404).json({
        error: "Tutor not found.",
      });
    }

    // Send the tutor's profile information to the frontend.
    return res.json({
      success: true,
      tutor,
    });
  } catch (error) {
    // Log any errors that happen while retrieving the tutor.
    console.error("Get tutor error:", error);

    return res.status(500).json({
      error: "Unable to load tutor.",
    });
  }
}

// Get additional information for a tutor's public profile.
async function getTutorExtras(req, res) {
  res.set("Cache-Control", "no-store");

  try {
    // Find the tutor using their profile URL.
    const tutor = await findTutorBySlug(
      req.params.slug
    );

    // Stop if the tutor does not exist.
    if (!tutor) {
      return res.status(404).json({
        error: "Tutor not found.",
      });
    }

    // Keep reviews empty until review integration is implemented.
    const reviews = [];

    // Get the tutor's upcoming availability, limited to 20 slots.
    const result = await pool.query(
      `SELECT
        a.id,
        a.available_date AS date,
        a.start_time AS "startTime",
        a.end_time AS "endTime"
       FROM public.tutor_availability a
       JOIN public.users u
         ON u.id = a.tutor_id
       JOIN public.tutor_profiles tp
         ON tp.user_id = a.tutor_id
       WHERE a.tutor_id = $1
         AND u.role = 'tutor'
         AND u.account_status = 'active'
         AND tp.approval_status = 'approved'
         AND a.is_available = TRUE
         AND (
           a.available_date > CURRENT_DATE
           OR (
             a.available_date = CURRENT_DATE
             AND a.end_time > LOCALTIME
           )
         )
       ORDER BY a.available_date, a.start_time
       LIMIT 20`,
      [tutor.userId]
    );

    // Convert the availability IDs into strings for the frontend.
    const availability = result.rows.map((slot) => ({
      ...slot,
      id: String(slot.id),
    }));

    // Return the tutor's reviews and availability information.
    return res.json({
      success: true,
      reviews,
      availability,
    });
  } catch (error) {
    // Log any errors that happen while loading additional tutor details.
    console.error("Tutor extras error:", error);

    return res.status(500).json({
      error: "Unable to load tutor availability.",
    });
  }
}

// Export the functions so they can be used in the tutor profile routes.
module.exports = {
  getMyTutorProfile,
  getTutors,
  getTutorBySlug,
  getTutorExtras,
};