
// Import the database connection to retrieve subjects.
const pool = require("../config/db");

// Get the list of subjects, with optional category and search filters.
const getSubjects = async (req, res) => {
  try {
    // Get the category and search term from the URL.
    const { category, search } = req.query;

    // Store the search conditions and their values.
    const conditions = [];
    const values = [];

    // Filter subjects by category if one is provided.
    if (category) {
      values.push(category);
      conditions.push(`category = $${values.length}`);
    }

    // Search for subjects with names matching the search term.
    if (search) {
      values.push(`%${search}%`);
      conditions.push(`name ILIKE $${values.length}`);
    }

    // Build the WHERE clause only when filters are provided.
    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    // Get matching subjects from the database in alphabetical order.
    const result = await pool.query(
      `SELECT id, name, slug, category
       FROM subjects
       ${whereClause}
       ORDER BY name ASC`,
      values
    );

    // Send the list of subjects back to the frontend.
    res.json({
      success: true,
      subjects: result.rows,
    });
  } catch (error) {
    // Log any errors that happen while loading subjects.
    console.error("Get subjects error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to load subjects",
    });
  }
};

// Get a single subject using its unique URL slug.
const getSubjectBySlug = async (req, res) => {
  try {
    // Search the database for the requested subject.
    const result = await pool.query(
      `SELECT id, name, slug, category
       FROM subjects
       WHERE slug = $1`,
      [req.params.slug]
    );

    // Return an error if the subject does not exist.
    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Subject not found",
      });
    }

    // Send the subject information back to the frontend.
    res.json({
      success: true,
      subject: result.rows[0],
    });
  } catch (error) {
    // Log any errors that happen while retrieving the subject.
    console.error("Get subject error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to load subject",
    });
  }
};

// Export both functions so they can be used in the subject routes.
module.exports = {
  getSubjects,
  getSubjectBySlug,
};
