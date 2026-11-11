
const pool = require("../config/db");

const getMyAccount = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, role, phone, created_at
       FROM public.users
       WHERE id = $1`,
      [req.user.userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Get account error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to load account",
    });
  }
};

const updateMyAccount = async (req, res) => {
  try {
    const { fullName, phone } = req.body;

    if (
      fullName !== undefined &&
      (typeof fullName !== "string" || !fullName.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid full name is required",
      });
    }

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

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "Account updated successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Update account error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to update account",
    });
  }
};

module.exports = {
  getMyAccount,
  updateMyAccount,
};
