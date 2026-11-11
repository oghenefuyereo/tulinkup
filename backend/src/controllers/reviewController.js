
const pool = require("../config/db");

const getTutorReviews = async (req, res) => {
  try {
    const { tutorId } = req.params;

    const result = await pool.query(
      `SELECT
         r.id,
         r.tutor_id,
         r.rating,
         r.comment,
         r.created_at,
         r.updated_at,
         u.full_name AS student_name
       FROM reviews r
       JOIN users u ON u.id = r.student_id
       WHERE r.tutor_id = $1
       ORDER BY r.created_at DESC`,
      [tutorId]
    );

    res.json({
      success: true,
      reviews: result.rows,
    });
  } catch (error) {
    console.error("Get reviews error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to load reviews",
    });
  }
};

const createReview = async (req, res) => {
  try {
    const studentId = req.user.userId;
    const { tutorId, rating, comment } = req.body;

    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can submit reviews",
      });
    }

    if (
      !Number.isInteger(Number(rating)) ||
      Number(rating) < 1 ||
      Number(rating) > 5 ||
      typeof comment !== "string" ||
      !comment.trim() ||
      comment.length > 800
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide a rating from 1 to 5 and a comment up to 800 characters",
      });
    }

    const result = await pool.query(
      `INSERT INTO reviews
         (student_id, tutor_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [studentId, tutorId, Number(rating), comment.trim()]
    );

    res.status(201).json({
      success: true,
      review: result.rows[0],
    });
  } catch (error) {
    console.error("Create review error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to create review",
    });
  }
};

const updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    if (
      !Number.isInteger(Number(rating)) ||
      Number(rating) < 1 ||
      Number(rating) > 5 ||
      typeof comment !== "string" ||
      !comment.trim() ||
      comment.length > 800
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide a valid rating and comment",
      });
    }

    const result = await pool.query(
      `UPDATE reviews
       SET rating = $1,
           comment = $2,
           updated_at = NOW()
       WHERE id = $3
         AND student_id = $4
       RETURNING *`,
      [Number(rating), comment.trim(), id, req.user.userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Review not found or access denied",
      });
    }

    res.json({
      success: true,
      review: result.rows[0],
    });
  } catch (error) {
    console.error("Update review error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to update review",
    });
  }
};

const deleteReview = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only administrators can delete reviews",
      });
    }

    const result = await pool.query(
      "DELETE FROM reviews WHERE id = $1 RETURNING id",
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    res.json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Delete review error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to delete review",
    });
  }
};

module.exports = {
  getTutorReviews,
  createReview,
  updateReview,
  deleteReview,
};
