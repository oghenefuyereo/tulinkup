
// Import the database connection to manage user account information.
const pool = require("../config/db");

// Get the account details of the currently logged-in user.
const getMyAccount = async (req, res) => {
  try {
    // Find the user's account using their authenticated user ID.
    const result = await pool.query(
      `SELECT id, full_name, email, role, phone, created_at
       FROM public.users
       WHERE id = $1`,
      [req.user.userId]
    );

    // Return an error if the user cannot be found.
    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Send the user's account information back to the frontend.
    res.json({
      success: true,
      user: result.rows[0],
    });
  } catch (error) {
    // Log any errors that happen while loading the account.
    console.error("Get account error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to load account",
    });
  }
};

// Allow a logged-in user to update their name and phone number.
const updateMyAccount = async (req, res) => {
  try {
    // Get the updated account details from the request.
    const { fullName, phone } = req.body;

    // Make sure the full name is valid if the user wants to change it.
    if (
      fullName !== undefined &&
      (typeof fullName !== "string" || !fullName.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid full name is required",
      });
    }

    // Check that the phone number is valid and not longer than 30 characters.
    if (
      phone !== undefined &&
      phone !== null &&
      (typeof phone !== "string" || phone.length > 30)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number",
      });
    }

    // Update the user's account while keeping any unchanged information.
    // The phone number can also be cleared if the user provides null.
    const result = await pool.query(
      `UPDATE public.users
       SET full_name = COALESCE($1, full_name),
           phone = CASE
             WHEN $2::boolean THEN $3::varchar
             ELSE phone
           END
       WHERE id = $4
       RETURNING id, full_name, email, role, phone, created_at`,
      [
        fullName === undefined ? null : fullName.trim(),
        phone !== undefined,
        phone === undefined ? null : phone,
        req.user.userId,
      ]
    );

    // Return an error if the user's account does not exist.
    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Confirm the update and return the latest account information.
    res.json({
      success: true,
      message: "Account updated successfully",
      user: result.rows[0],
    });
  } catch (error) {
    // Log any errors that happen while updating the account.
    console.error("Update account error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to update account",
    });
  }
};

// Export both functions so they can be used in the account routes.
module.exports = {
  getMyAccount,
  updateMyAccount,
};
