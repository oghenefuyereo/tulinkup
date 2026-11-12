
// Check whether the logged-in user has administrator access.
function requireAdmin(req, res, next) {
  // Block access if the user is not logged in or is not an administrator.
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      error: "Administrator access required.",
    });
  }

  // Allow the request to continue if the user is an administrator.
  next();
}

// Export the middleware so it can protect administrator routes.
module.exports = { requireAdmin };
