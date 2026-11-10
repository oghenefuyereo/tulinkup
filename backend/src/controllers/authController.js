
const bcrypt = require("bcryptjs");
const pool = require("../config/db");

// Register a student or tutor
const register = async (req, res) => {
  try {
    const { full_name, email, password, role } = req.body;

    // Validate required fields
    if (!full_name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    // Validate user role
    if (!["student", "tutor"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be student or tutor"
      });
    }

    // Validate password length
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if email already exists
    const existingUser = await pool.query(
      "SELECT id FROM public.users WHERE email = $1",
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email already registered"
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Insert user into PostgreSQL
    const result = await pool.query(
      `INSERT INTO public.users
       (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, role, created_at`,
      [full_name.trim(), normalizedEmail, passwordHash, role]
    );

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      user: result.rows[0]
    });

  } catch (error) {
    console.error("Registration error:", error.message);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Email already registered"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Registration failed"
    });
  }
};

module.exports = { register };