
// Import the JWT library to verify user authentication tokens.
const jwt = require("jsonwebtoken");

// Protect routes by checking whether the user has a valid login token.
const protect = (req, res, next) => {
  // Get the authentication information from the request headers.
  const authorization = req.headers.authorization;

  // Make sure the request includes a Bearer token.
  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  // Extract the token by removing "Bearer " from the header.
  const token = authorization.slice(7);

  // Check that the token and JWT secret are available.
  if (!token || !process.env.JWT_SECRET) {
    return res.status(401).json({
      success: false,
      message: "Invalid authentication",
    });
  }

  try {
    // Verify the token using the secret key and expected algorithm.
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET,
      { algorithms: ["HS256"] }
    );

    // Make sure the verified token contains a user ID.
    if (!decoded.userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    // Save the user's ID and role so other routes can access them.
    req.user = {
      userId: decoded.userId,
      role: decoded.role,
    };

    // Allow the request to continue after successful authentication.
    next();
  } catch {
    // Reject the request if the token is invalid or has expired.
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

// Export the middleware so it can protect routes that require login.
module.exports = { protect };
