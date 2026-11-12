
// Import Express to create routes for uploading media files.
const express = require("express");

// Import Multer to handle image uploads.
const multer = require("multer");

// Import the middleware that checks whether a user is logged in.
const { protect } = require("../middleware/authMiddleware");

// Import the function that handles profile image uploads.
const {
  uploadProfileImage,
} = require("../controllers/mediaController");

// Create a router to handle media upload requests.
const router = express.Router();

// Configure Multer to handle uploaded images.
const upload = multer({
  // Temporarily store uploaded images in memory.
  storage: multer.memoryStorage(),

  // Limit each uploaded image to 5 MB.
  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  // Check the image type before accepting the upload.
  fileFilter(req, file, callback) {
    // Allow only JPEG, PNG, and WebP images.
    if (
      ["image/jpeg", "image/png", "image/webp"].includes(
        file.mimetype
      )
    ) {
      // Accept the image if its file type is supported.
      callback(null, true);
    } else {
      // Reject the upload if the image type is not supported.
      callback(new Error("Unsupported image type."));
    }
  },
});

// Protected route to upload a user's profile image.
router.post(
  "/profile-image",
  protect,
  upload.single("image"),
  uploadProfileImage
);

// Export the router so it can be used in the main server.
module.exports = router;
