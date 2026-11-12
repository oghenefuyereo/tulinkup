
// Import the database connection to retrieve tags.
const pool = require("../config/db");

// Get all available tags from the database.
const getTags = async (req, res) => {
  try {
    // Get the tags and arrange them in alphabetical order.
    const result = await pool.query(
      `SELECT id, name
       FROM public.tags
       ORDER BY name ASC`
    );

    // Send the list of tags back to the frontend.
    res.json({
      success: true,
      tags: result.rows,
    });
  } catch (error) {
    // Log any errors that happen while loading tags.
    console.error("Get tags error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to load tags",
    });
  }
};

// Get a specific tag using its ID.
const getTagById = async (req, res) => {
  try {
    // Get the tag ID from the URL.
    const { id } = req.params;

    // Make sure the ID contains only numbers.
    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tag ID",
      });
    }

    // Search the database for the tag with the matching ID.
    const result = await pool.query(
      `SELECT id, name
       FROM public.tags
       WHERE id = $1`,
      [id]
    );

    // Return an error if the tag does not exist.
    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Tag not found",
      });
    }

    // Send the requested tag back to the frontend.
    res.json({
      success: true,
      tag: result.rows[0],
    });
  } catch (error) {
    // Log any errors that happen while retrieving the tag.
    console.error("Get tag error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to load tag",
    });
  }
};

// Export both functions so they can be used in the tag routes.
module.exports = {
  getTags,
  getTagById,
};
