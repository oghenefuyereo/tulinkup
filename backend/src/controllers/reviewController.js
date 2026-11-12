
// Import the database connection to manage tutor reviews.
const pool = require("../config/db");

// Get all reviews for a specific tutor.
const getTutorReviews = async (req, res) => {
  try {
    // Get the tutor's ID from the URL.
    const { tutorId } = req.params;

    // Find the tutor's reviews and include the names of the students.
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

    // Send the reviews back to the frontend.
    res.json({
      success: true,
      reviews: result.rows,
    });
  } catch (error) {
    // Log any errors that happen while loading reviews.
    console.error("Get reviews error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to load reviews",
    });
  }
};

// Allow a student to submit a review for a tutor.
const createReview = async (req, res) => {
  try {
    // Get the logged-in student's ID and the submitted review details.
    const studentId = req.user.userId;
    const { tutorId, rating, comment } = req.body;

    // Only students are allowed to submit reviews.
    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can submit reviews",
      });
    }

    // Make sure the rating is between 1 and 5 and the comment is valid.
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

    // Save the student's review in the database.
    const result = await pool.query(
      `INSERT INTO reviews
         (student_id, tutor_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [studentId, tutorId, Number(rating), comment.trim()]
    );

    // Confirm that the review was created successfully.
    res.status(201).json({
      success: true,
      review: result.rows[0],
    });
  } catch (error) {
    // Log any errors that happen while creating a review.
    console.error("Create review error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to create review",
    });
  }
};

// Allow a student to update a review they previously submitted.
const updateReview = async (req, res) => {
  try {
    // Get the review ID and the updated rating and comment.
    const { id } = req.params;
    const { rating, comment } = req.body;

    // Check that the new rating and comment meet the requirements.
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

    // Update the review only if it belongs to the logged-in student.
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

    // Return an error if the review does not exist or belongs to another user.
    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Review not found or access denied",
      });
    }

    // Send the updated review back to the frontend.
    res.json({
      success: true,
      review: result.rows[0],
    });
  } catch (error) {
    // Log any errors that happen while updating the review.
    console.error("Update review error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to update review",
    });
  }
};

// Allow an administrator to remove a review.
const deleteReview = async (req, res) => {
  try {
    // Make sure the logged-in user has administrator access.
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only administrators can delete reviews",
      });
    }

    // Delete the selected review from the database.
    const result = await pool.query(
      "DELETE FROM reviews WHERE id = $1 RETURNING id",
      [req.params.id]
    );

    // Return an error if the review cannot be found.
    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // Confirm that the review was deleted successfully.
    res.json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    // Log any errors that happen while deleting a review.
    console.error("Delete review error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to delete review",
    });
  }
};

// Export the functions so they can be used in the review routes.
module.exports = {
  getTutorReviews,
  createReview,
  updateReview,
  deleteReview,
};
