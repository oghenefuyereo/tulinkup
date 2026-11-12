
// Import crypto to create unique names for uploaded images.
const crypto = require("crypto");
const path = require("path");

// Import the database connection and Supabase client.
const pool = require("../config/db");
const supabase = require("../config/supabase");

// Define the image formats tutors are allowed to upload.
const ALLOWED_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

// Allow tutors to upload a profile picture.
async function uploadProfileImage(req, res) {
  // Keep track of the uploaded file in case we need to remove it.
  let uploadedPath = null;

  try {
    // Only tutors can upload a profile picture through this endpoint.
    if (req.user?.role !== "tutor") {
      return res.status(403).json({
        error: "Tutor access required.",
      });
    }

    // Make sure the tutor selected an image.
    if (!req.file) {
      return res.status(400).json({
        error: "Please select an image.",
      });
    }

    // Check the file type and get its matching extension.
    const extension = ALLOWED_TYPES[req.file.mimetype];

    // Reject files that are not in one of the supported formats.
    if (!extension) {
      return res.status(400).json({
        error: "Only JPEG, PNG, and WebP images are supported.",
      });
    }

    // Get the ID of the logged-in tutor.
    const userId = req.user.userId;

    // Check whether the tutor has already created a profile.
    const profile = await pool.query(
      `SELECT id
       FROM public.tutor_profiles
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );

    // Require a tutor profile before allowing an image upload.
    if (!profile.rows.length) {
      return res.status(400).json({
        error: "Create your tutor profile first.",
      });
    }

    // Give the image a unique name and place it in the tutor's folder.
    uploadedPath = `${userId}/${crypto.randomUUID()}${extension}`;

    // Upload the image to the profile-images bucket in Supabase Storage.
    const { error: uploadError } = await supabase.storage
      .from("profile-images")
      .upload(uploadedPath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    // Stop the process if Supabase cannot upload the image.
    if (uploadError) {
      throw uploadError;
    }

    // Get the public URL of the uploaded image.
    const { data } = supabase.storage
      .from("profile-images")
      .getPublicUrl(uploadedPath);

    const imageUrl = data.publicUrl;

    // Save the image URL in the tutor's database profile.
    await pool.query(
      `UPDATE public.tutor_profiles
       SET profile_image_url = $1
       WHERE user_id = $2`,
      [imageUrl, userId]
    );

    // Confirm the upload and return the image information.
    return res.json({
      success: true,
      message: "Profile image uploaded successfully.",
      image: {
        url: imageUrl,
        alt: "Tutor profile picture",
      },
    });
  } catch (error) {
    // Remove the uploaded image if an error happens during the process.
    if (uploadedPath) {
      await supabase.storage
        .from("profile-images")
        .remove([uploadedPath]);
    }

    // Log the error to help identify what went wrong.
    console.error("Media upload error:", error);

    return res.status(500).json({
      error: "Unable to upload profile image.",
    });
  }
}

// Export the function so it can be used in the media routes.
module.exports = { uploadProfileImage };
