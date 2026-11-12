
// Import the database connection to retrieve tutor information.
const pool = require("../config/db");

// Format tutor information so the frontend can display it easily.
function formatTutor(row) {
  // Turn the tutor's subjects into a list of subject objects.
  const subjects = String(row.subject || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ id: name, name }));

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
`;

// Create a unique URL slug using the tutor's name and user ID.
function makeSlug(fullName, userId) {
  // Convert the name to lowercase and remove special characters.
  const base = String(fullName || "tutor")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Add the user ID so tutors with similar names have different URLs.
  return `${base || "tutor"}-${userId}`;
}

// Get the profile information of the currently logged-in tutor.
async function getMyTutorProfile(req, res) {
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
        profile_image_url
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

    // Return the profile with formatted subjects and hourly rate.
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
    // Log any errors that happen while loading the tutor's profile.
    console.error("Tutor profile error:", error);

    return res.status(500).json({
      error: "Unable to load tutor profile.",
    });
  }
}

// Get a list of tutor profiles for the platform.
async function getTutors(req, res) {
  try {
    // Retrieve up to 100 tutors, sorted alphabetically by name.
    const result = await pool.query(
      `${tutorSelect}
       ORDER BY u.full_name ASC
       LIMIT 100`
    );

    // Format each tutor's details and create a unique profile URL.
    const tutors = result.rows.map((row) => ({
      ...formatTutor(row),
      slug: makeSlug(row.full_name, row.user_id),
    }));

    // Send the tutor list back to the frontend.
    return res.json({ success: true, tutors });
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
  const canonicalSlug = makeSlug(row.full_name, row.user_id);

  // Reject the request if the slug does not match the tutor's current URL.
  if (canonicalSlug !== slug) return null;

  // Return the tutor's formatted profile information.
  return {
    ...formatTutor(row),
    slug: canonicalSlug,
  };
}

// Get a tutor's public profile using their URL slug.
async function getTutorBySlug(req, res) {
  try {
    // Find the tutor using the slug provided in the URL.
    const tutor = await findTutorBySlug(req.params.slug);

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
  try {
    // Find the tutor using their profile URL.
    const tutor = await findTutorBySlug(req.params.slug);

    // Stop if the tutor does not exist.
    if (!tutor) {
      return res.status(404).json({
        error: "Tutor not found.",
      });
    }

    // Reviews are not implemented in the current schema.
    const reviews = [];
    let availability = [];

    // Requires the tutor_availability migration.
    // Get the tutor's upcoming availability, limited to 20 slots.
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

    // Convert the availability IDs into strings for the frontend.
    availability = result.rows.map((slot) => ({
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
