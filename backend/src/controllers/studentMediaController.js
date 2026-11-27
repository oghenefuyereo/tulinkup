"use strict";

const crypto = require("node:crypto");
const pool = require("../config/db");
const supabase = require("../config/supabase");

const {
  processProfileImage,
  MAX_IMAGE_BYTES,
} = require("../utils/profileImage");

const BUCKET = "student-profile-images";

function fail(res, status, message) {
  return res.status(status).json({
    success: false,
    error: message,
  });
}

// Validate storage paths before accessing private images.
function isOwnedImagePath(path, userId) {
  if (
    typeof path !== "string" ||
    !/^[1-9][0-9]{0,18}$/.test(String(userId))
  ) {
    return false;
  }

  const prefix = `${userId}/`;

  if (!path.startsWith(prefix)) {
    return false;
  }

  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$/
    .test(path.slice(prefix.length));
}

// Retrieve only an active student's profile image path.
async function getStudentImageRecord(userId) {
  const result = await pool.query(
    `SELECT sp.profile_image_path
     FROM public.users AS u
     LEFT JOIN public.student_profiles AS sp
       ON sp.user_id = u.id
     WHERE u.id = $1
       AND u.role = 'student'
       AND u.account_status = 'active'
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
}

// Remove an obsolete owned image.
async function cleanupImage(path, userId) {
  if (!path) return true;

  if (!isOwnedImagePath(path, userId)) {
    return false;
  }

  try {
    const { error } = await supabase.storage
      .from(BUCKET)
      .remove([path]);

    if (error) throw error;

    return true;

  } catch {
    console.error("Student image cleanup failed.");

    return false;
  }
}

// Create a profile if necessary, without changing text fields.
// Compare the previous image path to prevent stale updates.
async function saveImagePath(userId, previousPath, newPath) {
  const result = await pool.query(
    `INSERT INTO public.student_profiles AS sp (
       user_id,
       profile_image_path
     )
     SELECT u.id, $2
     FROM public.users AS u
     WHERE u.id = $1
       AND u.role = 'student'
       AND u.account_status = 'active'
       AND (
         $3::text IS NULL
         OR EXISTS (
           SELECT 1
           FROM public.student_profiles AS existing
           WHERE existing.user_id = u.id
             AND existing.profile_image_path = $3
         )
       )
     ON CONFLICT (user_id)
     DO UPDATE SET
       profile_image_path = EXCLUDED.profile_image_path,
       updated_at = NOW()
     WHERE sp.profile_image_path
       IS NOT DISTINCT FROM $3::text
     RETURNING user_id`,
    [userId, newPath, previousPath]
  );

  return result.rowCount === 1;
}

// Clear only the current image reference.
async function clearImagePath(userId, previousPath) {
  const result = await pool.query(
    `UPDATE public.student_profiles AS sp
     SET profile_image_path = NULL,
         updated_at = NOW()
     WHERE sp.user_id = $1
       AND sp.profile_image_path = $2
       AND EXISTS (
         SELECT 1
         FROM public.users AS u
         WHERE u.id = sp.user_id
           AND u.role = 'student'
           AND u.account_status = 'active'
       )
     RETURNING sp.user_id`,
    [userId, previousPath]
  );

  return result.rowCount === 1;
}

// Retrieve the authenticated student's private image.
async function getStudentProfileImage(req, res) {
  res.set("Cache-Control", "private, no-store");

  const userId = req.user?.userId;

  if (!userId || req.user?.role !== "student") {
    return fail(res, 403, "Student access required.");
  }

  try {
    const record = await getStudentImageRecord(userId);

    if (!record) {
      return fail(res, 403, "Student account unavailable.");
    }

    const path = record.profile_image_path;

    if (!path) {
      return fail(res, 404, "No profile picture found.");
    }

    if (!isOwnedImagePath(path, userId)) {
      throw new Error("Invalid stored image path.");
    }

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(path);

    if (error || !data) {
      throw new Error("Image retrieval failed.");
    }

    if (data.size === 0 || data.size > MAX_IMAGE_BYTES) {
      throw new Error("Invalid stored image size.");
    }

    const buffer = Buffer.from(
      await data.arrayBuffer()
    );

    if (
      buffer.length < 12 ||
      buffer.length > MAX_IMAGE_BYTES ||
      buffer.toString("ascii", 0, 4) !== "RIFF" ||
      buffer.toString("ascii", 8, 12) !== "WEBP"
    ) {
      throw new Error("Invalid stored image format.");
    }

    // Confirm the image is still current before returning it.
    const current = await getStudentImageRecord(userId);

    if (!current) {
      return fail(res, 403, "Student account unavailable.");
    }

    if (current.profile_image_path !== path) {
      return fail(
        res,
        409,
        "Profile picture changed. Please try again."
      );
    }

    res.set({
      "Content-Type": "image/webp",
      "Content-Length": String(buffer.length),
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
    });

    return res.status(200).end(buffer);

  } catch {
    console.error("Student profile image retrieval failed.");

    return fail(
      res,
      500,
      "Unable to retrieve profile picture."
    );
  }
}

// Upload or replace a student's profile picture.
async function uploadStudentProfileImage(req, res) {
  res.set("Cache-Control", "private, no-store");

  const userId = req.user?.userId;

  if (!userId || req.user?.role !== "student") {
    return fail(res, 403, "Student access required.");
  }

  let uploadedPath = null;
  let databaseUpdateStarted = false;

  try {
    const record = await getStudentImageRecord(userId);

    if (!record) {
      return fail(res, 403, "Student account unavailable.");
    }

    const previousPath = record.profile_image_path;

    if (
      previousPath &&
      !isOwnedImagePath(previousPath, userId)
    ) {
      throw new Error("Invalid existing image path.");
    }

    const processed = await processProfileImage(req.file);

    if (processed.buffer.length > MAX_IMAGE_BYTES) {
      return fail(
        res,
        413,
        "Processed image exceeds 4 MiB."
      );
    }

    const path =
      `${userId}/${crypto.randomUUID()}.webp`;

    const { error: uploadError } =
      await supabase.storage
        .from(BUCKET)
        .upload(path, processed.buffer, {
          contentType: "image/webp",
          upsert: false,
          cacheControl: "0",
        });

    if (uploadError) throw uploadError;

    uploadedPath = path;

    databaseUpdateStarted = true;

    const updated = await saveImagePath(
      userId,
      previousPath,
      path
    );

    if (!updated) {
      await cleanupImage(uploadedPath, userId);

      return fail(
        res,
        409,
        "Your profile changed. Please try again."
      );
    }

    const cleaned = await cleanupImage(
      previousPath,
      userId
    );

    return res.json({
      success: true,
      message: "Profile picture uploaded successfully.",
      hasProfileImage: true,
      cleanupPending: !cleaned,
    });

  } catch (error) {
    // Preserve the uploaded image if the database
    // update outcome is uncertain.
    if (uploadedPath && !databaseUpdateStarted) {
      await cleanupImage(uploadedPath, userId);
    }

    if ([400, 413, 415].includes(error.status)) {
      return fail(res, error.status, error.message);
    }

    console.error("Student profile image upload failed.");

    return fail(
      res,
      500,
      "Unable to upload profile picture."
    );
  }
}

// Remove a student's profile picture.
async function removeStudentProfileImage(req, res) {
  res.set("Cache-Control", "private, no-store");

  const userId = req.user?.userId;

  if (!userId || req.user?.role !== "student") {
    return fail(res, 403, "Student access required.");
  }

  try {
    const record = await getStudentImageRecord(userId);

    if (!record) {
      return fail(res, 403, "Student account unavailable.");
    }

    const previousPath = record.profile_image_path;

    let cleaned = true;

    if (previousPath) {
      if (!isOwnedImagePath(previousPath, userId)) {
        throw new Error("Invalid stored image path.");
      }

      const updated = await clearImagePath(
        userId,
        previousPath
      );

      if (!updated) {
        return fail(
          res,
          409,
          "Your profile changed. Please try again."
        );
      }

      cleaned = await cleanupImage(
        previousPath,
        userId
      );
    }

    return res.json({
      success: true,
      message: "Profile picture removed successfully.",
      hasProfileImage: false,
      cleanupPending: !cleaned,
    });

  } catch {
    console.error("Student profile image removal failed.");

    return fail(
      res,
      500,
      "Unable to remove profile picture."
    );
  }
}

module.exports = {
  isOwnedImagePath,
  getStudentProfileImage,
  uploadStudentProfileImage,
  removeStudentProfileImage,
};
