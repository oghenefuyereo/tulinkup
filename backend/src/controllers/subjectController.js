
const pool = require("../config/db");

const getSubjects = async (req, res) => {
  try {
    const { category, search } = req.query;

    const conditions = [];
    const values = [];

    if (category) {
      values.push(category);
      conditions.push(`category = $${values.length}`);
    }

    if (search) {
      values.push(`%${search}%`);
      conditions.push(`name ILIKE $${values.length}`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const result = await pool.query(
      `SELECT id, name, slug, category
       FROM subjects
       ${whereClause}
       ORDER BY name ASC`,
      values
    );

    res.json({
      success: true,
      subjects: result.rows,
    });
  } catch (error) {
    console.error("Get subjects error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to load subjects",
    });
  }
};

const getSubjectBySlug = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, slug, category
       FROM subjects
       WHERE slug = $1`,
      [req.params.slug]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Subject not found",
      });
    }

    res.json({
      success: true,
      subject: result.rows[0],
    });
  } catch (error) {
    console.error("Get subject error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to load subject",
    });
  }
};

module.exports = {
  getSubjects,
  getSubjectBySlug,
};
