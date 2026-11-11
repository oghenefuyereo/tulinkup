
const pool = require("../config/db");

const getTags = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name
       FROM public.tags
       ORDER BY name ASC`
    );

    res.json({
      success: true,
      tags: result.rows,
    });
  } catch (error) {
    console.error("Get tags error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to load tags",
    });
  }
};

const getTagById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tag ID",
      });
    }

    const result = await pool.query(
      `SELECT id, name
       FROM public.tags
       WHERE id = $1`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Tag not found",
      });
    }

    res.json({
      success: true,
      tag: result.rows[0],
    });
  } catch (error) {
    console.error("Get tag error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to load tag",
    });
  }
};

module.exports = {
  getTags,
  getTagById,
};
