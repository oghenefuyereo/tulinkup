
const express = require("express");

const { protect } = require("../middleware/authMiddleware");

const {
  getGroupClasses,
  getGroupClassById,
  getMyGroupClasses,
  createGroupClass,
  updateGroupClass,
  updateGroupClassStatus,
  enrollInGroupClass,
  cancelEnrollment,
  getMyEnrollments,
  getClassStudents,
} = require("../controllers/groupClassController");

const router = express.Router();

// Public routes.
router.get("/", getGroupClasses);

// Tutor and student dashboard routes.
router.get("/me", protect, getMyGroupClasses);

router.get(
  "/my-enrollments",
  protect,
  getMyEnrollments
);

// Create a group class.
router.post("/", protect, createGroupClass);

// View students enrolled in a class.
router.get(
  "/:id/students",
  protect,
  getClassStudents
);

// Enrol in a group class.
router.post(
  "/:id/enroll",
  protect,
  enrollInGroupClass
);

// Cancel a student's group class enrolment.
router.patch(
  "/:id/cancel-enrollment",
  protect,
  cancelEnrollment
);

// Publish or cancel a class.
router.patch(
  "/:id/status",
  protect,
  updateGroupClassStatus
);

// Edit a group class.
router.put(
  "/:id",
  protect,
  updateGroupClass
);

// View class details.
router.get("/:id", getGroupClassById);

module.exports = router;
