const express = require("express");
const multer = require("multer");

const { protect } = require("../middleware/authMiddleware");

const {
  uploadProfileImage,
  removeProfileImage,
} = require("../controllers/mediaController");

const {
  MAX_IMAGE_BYTES,
  ALLOWED_IMAGE_TYPES,
} = require("../utils/profileImage");

const router = express.Router();

// Reject unauthorized users before processing uploaded files.
function requireTutor(req, res, next) {
  if (!req.user?.userId || req.user.role !== "tutor") {
    return res.status(403).json({
      error: "Tutor access required.",
    });
  }

  next();
}

// Restrict uploaded files and temporary memory usage.
const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: 1,
    fields: 0,
    parts: 2,
  },

  fileFilter(req, file, callback) {
    if (
      Object.hasOwn(ALLOWED_IMAGE_TYPES, file.mimetype)
    ) {
      return callback(null, true);
    }

    const error = new Error(
      "Only JPEG, PNG, and WebP images are supported."
    );

    error.status = 415;

    return callback(error);
  },
});

// Convert upload errors into appropriate HTTP responses.
function parseProfileImage(req, res, next) {
  upload.single("image")(req, res, (error) => {
    if (!error) return next();

    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: "Profile images must not exceed 4 MiB.",
      });
    }

    if (error.status === 415) {
      return res.status(415).json({
        error: error.message,
      });
    }

    return res.status(400).json({
      error: "Invalid profile image upload.",
    });
  });
}

// Upload or replace a profile image.
router.post(
  "/profile-image",
  protect,
  requireTutor,
  parseProfileImage,
  uploadProfileImage
);

// Remove a profile image.
router.delete(
  "/profile-image",
  protect,
  requireTutor,
  removeProfileImage
);

module.exports = router;
