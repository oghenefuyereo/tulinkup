"use strict";

// Import Express.
const express = require("express");

// Import authentication and authorization middleware.
const { protect } = require("../middleware/authMiddleware");
const { requireAdmin } = require("../middleware/adminMiddleware");

// Import administrator controller functions.
const {
  getAdminDashboard,
  getAdminUsers,
  getAdminUserById,
  getAdminStudents,
  getAdminTutors
} = require("../controllers/adminController");

// Create the administrator router.
const router = express.Router();

// Protect every administrator endpoint.
router.use(protect, requireAdmin);

// Administrator dashboard endpoint.
router.get("/dashboard", getAdminDashboard);

// Administrator user listing endpoint.
router.get("/users", getAdminUsers);
router.get("/users/:id", getAdminUserById);

// Export the administrator router.
router.get("/students", getAdminStudents);
router.get("/tutors", getAdminTutors);

const {
  getAdminAuditLogs,
} = require("../controllers/adminAuditController");

router.get("/audit-logs", getAdminAuditLogs);

module.exports = router;
