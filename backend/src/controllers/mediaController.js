
const crypto = require("crypto");
const path = require("path");

const pool = require("../config/db");
const supabase = require("../config/supabase");

const ALLOWED_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

async function uploadProfileImage(req, res) {
  let uploadedPath = null;

  try {
    if (req.user?.role !== "tutor") {
      return res.status(403).json({
        error: "Tutor access required.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "Please select an image.",
      });
    }

    const extension = ALLOWED_TYPES[req.file.mimetype];

    if (!extension) {
      return res.status(400).json({
        error: "Only JPEG, PNG, and WebP images are supported.",
      });
    }

    const userId = req.user.userId;

    const profile = await pool.query(
      `SELECT id
       FROM public.tutor_profiles
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );

    if (!profile.rows.length) {
      return res.status(400).json({
        error: "Create your tutor profile first.",
      });
    }

    uploadedPath = `${userId}/${crypto.randomUUID()}${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("profile-images")
      .upload(uploadedPath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from("profile-images")
      .getPublicUrl(uploadedPath);

    const imageUrl = data.publicUrl;

    await pool.query(
      `UPDATE public.tutor_profiles
       SET profile_image_url = $1
       WHERE user_id = $2`,
      [imageUrl, userId]
    );

    return res.json({
      success: true,
      message: "Profile image uploaded successfully.",
      image: {
        url: imageUrl,
        alt: "Tutor profile picture",
      },
    });
  } catch (error) {
    if (uploadedPath) {
      await supabase.storage
        .from("profile-images")
        .remove([uploadedPath]);
    }

    console.error("Media upload error:", error);

    return res.status(500).json({
      error: "Unable to upload profile image.",
    });
  }
}

module.exports = { uploadProfileImage };
