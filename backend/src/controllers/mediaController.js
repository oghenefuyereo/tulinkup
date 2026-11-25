const crypto = require("crypto");
const pool = require("../config/db");
const supabase = require("../config/supabase");
const {
  processProfileImage,
} = require("../utils/profileImage");

const BUCKET = "profile-images";

// Only accept storage paths belonging to the authenticated tutor.
function getOwnedImagePath(imageUrl, userId) {
  if (!imageUrl) return null;

  try {
    const url = new URL(imageUrl);

    const prefix = new URL(
      supabase.storage.from(BUCKET)
        .getPublicUrl(`${userId}/`).data.publicUrl
    );

    if (
      url.origin !== prefix.origin ||
      !url.pathname.startsWith(prefix.pathname)
    ) {
      return null;
    }

    const filename = url.pathname.slice(
      prefix.pathname.length
    );

    if (
      !/^[a-f0-9-]{36}\.(webp|jpg|jpeg|png)$/i.test(filename)
    ) {
      return null;
    }

    return `${userId}/${filename}`;
  } catch {
    return null;
  }
}

// Remove an obsolete image without changing a successful response.
async function cleanupImage(path) {
  if (!path) return;

  try {
    const { error } = await supabase.storage
      .from(BUCKET)
      .remove([path]);

    if (error) throw error;
  } catch {
    console.error("Profile image cleanup failed:", path);
  }
}

// Retrieve the authenticated tutor's current profile image.
async function getProfile(userId) {
  const result = await pool.query(
    `SELECT id, profile_image_url
     FROM public.tutor_profiles
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
}

// Prevent simultaneous requests from overwriting newer changes.
async function changeProfileImage(userId, oldUrl, newUrl) {
  const result = await pool.query(
    `UPDATE public.tutor_profiles
     SET profile_image_url = $1
     WHERE user_id = $2
       AND profile_image_url IS NOT DISTINCT FROM $3
     RETURNING id`,
    [newUrl, userId, oldUrl]
  );

  return result.rowCount === 1;
}

// Upload or replace a tutor's profile image.
async function uploadProfileImage(req, res) {
  const userId = req.user?.userId;

  if (!userId || req.user?.role !== "tutor") {
    return res.status(403).json({
      error: "Tutor access required.",
    });
  }

  let uploadedPath = null;
  let databaseUpdateStarted = false;

  try {
    const profile = await getProfile(userId);

    if (!profile) {
      return res.status(400).json({
        error: "Create your tutor profile first.",
      });
    }

    // Validate the actual image content and compress it.
    const processed = await processProfileImage(req.file);

    const path =
      `${userId}/${crypto.randomUUID()}.webp`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, processed.buffer, {
        contentType: processed.contentType,
        upsert: false,
        cacheControl: "3600",
      });

    if (uploadError) throw uploadError;

    uploadedPath = path;

    const { data } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(path);

    const imageUrl = data.publicUrl;

    databaseUpdateStarted = true;

    const updated = await changeProfileImage(
      userId,
      profile.profile_image_url,
      imageUrl
    );

    if (!updated) {
      await cleanupImage(uploadedPath);

      return res.status(409).json({
        error: "Your profile changed. Please try again.",
      });
    }

    // Remove the previous image only after saving the new URL.
    await cleanupImage(
      getOwnedImagePath(
        profile.profile_image_url,
        userId
      )
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
    // Avoid deleting an image if the database update outcome
    // is uncertain.
    if (uploadedPath && !databaseUpdateStarted) {
      await cleanupImage(uploadedPath);
    }

    if ([400, 413, 415].includes(error.status)) {
      return res.status(error.status).json({
        error: error.message,
      });
    }

    console.error("Profile image upload failed.");

    return res.status(500).json({
      error: "Unable to upload profile image.",
    });
  }
}

// Remove a tutor's profile image.
async function removeProfileImage(req, res) {
  const userId = req.user?.userId;

  if (!userId || req.user?.role !== "tutor") {
    return res.status(403).json({
      error: "Tutor access required.",
    });
  }

  try {
    const profile = await getProfile(userId);

    if (!profile) {
      return res.status(404).json({
        error: "Tutor profile not found.",
      });
    }

    if (profile.profile_image_url) {
      const updated = await changeProfileImage(
        userId,
        profile.profile_image_url,
        null
      );

      if (!updated) {
        return res.status(409).json({
          error: "Your profile changed. Please try again.",
        });
      }

      await cleanupImage(
        getOwnedImagePath(
          profile.profile_image_url,
          userId
        )
      );
    }

    return res.json({
      success: true,
      message: "Profile image removed successfully.",
      image: null,
    });
  } catch {
    console.error("Profile image removal failed.");

    return res.status(500).json({
      error: "Unable to remove profile image.",
    });
  }
}

module.exports = {
  uploadProfileImage,
  removeProfileImage,
};
