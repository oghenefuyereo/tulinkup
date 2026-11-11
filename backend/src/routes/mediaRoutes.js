
const express = require("express");
const multer = require("multer");

const { protect } = require("../middleware/authMiddleware");
const {
  uploadProfileImage,
} = require("../controllers/mediaController");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter(req, file, callback) {
    if (
      ["image/jpeg", "image/png", "image/webp"].includes(
        file.mimetype
      )
    ) {
      callback(null, true);
    } else {
      callback(new Error("Unsupported image type."));
    }
  },
});

router.post(
  "/profile-image",
  protect,
  upload.single("image"),
  uploadProfileImage
);

module.exports = router;
