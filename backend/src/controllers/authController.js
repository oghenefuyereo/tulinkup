
// Import bcrypt to securely hash and verify user passwords.
const bcrypt = require("bcryptjs");

// Import the database connection to access user information.
const pool = require("../config/db");

// Register a new student or tutor account.
const register = async (req, res) => {
  try {
    // Get the information submitted during registration.
    const { full_name, email, password, role } = req.body;

    // Make sure the user has filled in all required fields.
    if (!full_name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    // Only students and tutors can register.
    if (!["student", "tutor"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be student or tutor"
      });
    }

    // Require a password with at least eight characters.
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters"
      });
    }

    // Remove extra spaces and convert the email to lowercase.
    const normalizedEmail = email.trim().toLowerCase();

    // Check the database to see if the email is already registered.
    const existingUser = await pool.query(
      "SELECT id FROM public.users WHERE email = $1",
      [normalizedEmail]
    );

    // Prevent users from creating multiple accounts with the same email.
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email already registered"
      });
    }

    // Hash the password before saving it to the database.
    const passwordHash = await bcrypt.hash(password, 12);

    // Save the new user and return their account information.
    const result = await pool.query(
      `INSERT INTO public.users
       (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, role, created_at`,
      [full_name.trim(), normalizedEmail, passwordHash, role]
    );

    // Confirm that the account was created successfully.
    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      user: result.rows[0]
    });

  } catch (error) {
    // Log any unexpected registration errors.
    console.error("Registration error:", error.message);

    // Handle duplicate email errors returned by PostgreSQL.
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "Email already registered"
      });
    }

    // Return a general error if registration fails.
    return res.status(500).json({
      success: false,
      message: "Registration failed"
    });
  }
};


// Import JWT to create authentication tokens after login.
const jwt = require("jsonwebtoken");

// Log in an existing student or tutor.
const login = async (req, res) => {
  try {
    // Get the email and password submitted by the user.
    const { email, password } = req.body;

    // Check that both login fields contain valid information.
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    // Convert the email to lowercase for a consistent database lookup.
    const normalizedEmail = email.trim().toLowerCase();

    // Search for the account using the submitted email.
    const result = await pool.query(
      `SELECT id, full_name, email, password_hash, role
       FROM public.users
       WHERE email = $1`,
      [normalizedEmail]
    );

    // Reject the login if no account matches the email.
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Get the user's information from the database result.
    const user = result.rows[0];

    // Compare the submitted password with the stored password hash.
    const isPasswordValid = await bcrypt.compare(
      password,
      user.password_hash
    );

    // Reject the login if the password is incorrect.
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Make sure the secret key needed to sign tokens is configured.
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured");
    }

    // Create a token containing the user's ID and role.
    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Send the token and user information after a successful login.
    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    // Log any errors that happen during login.
    console.error("Login error:", error.message);

    // Return a general error if the login process fails.
    return res.status(500).json({
      success: false,
      message: "Login failed"
    });
  }
};


// Get the profile information of the currently authenticated user.
const getMe = async (req, res) => {
  try {
    // Use the authenticated user's ID to find their account.
    const result = await pool.query(
      `SELECT id, full_name, email, role
       FROM public.users
       WHERE id = $1`,
      [req.user.userId]
    );

    // Return an error if the account no longer exists.
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Return the current user's account information.
    return res.json({
      success: true,
      user: result.rows[0],
    });
  } catch (error) {
    // Log any errors while retrieving the user's information.
    console.error("Get current user error:", error.message);

    // Return a general error if the user cannot be retrieved.
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve user",
    });
  }
};

// Export these functions so the authentication routes can use them.
module.exports = { register, login, getMe };
