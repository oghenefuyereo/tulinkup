const sharp = require("sharp");

// Define profile image restrictions.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 25000000;
const MAX_IMAGE_DIMENSION = 800;

const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};

// Create an image validation error.
function imageError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// Validate and process uploaded profile images.
async function processProfileImage(file) {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    throw imageError("Please select an image.");
  }

  if (file.buffer.length === 0) {
    throw imageError("The selected image is empty.");
  }

  if (file.buffer.length > MAX_IMAGE_BYTES) {
    throw imageError(
      "Profile images must not exceed 4 MiB.",
      413
    );
  }

  const expectedFormat = ALLOWED_IMAGE_TYPES[file.mimetype];

  if (!expectedFormat) {
    throw imageError(
      "Only JPEG, PNG, and WebP images are supported.",
      415
    );
  }

  try {
    const image = sharp(file.buffer, {
      failOn: "warning",
      limitInputPixels: MAX_IMAGE_PIXELS,
    });

    const metadata = await image.metadata();

    if (metadata.format !== expectedFormat) {
      throw imageError(
        "The image content does not match its file type.",
        415
      );
    }

    if (!metadata.width || !metadata.height) {
      throw imageError("Invalid image dimensions.");
    }

    if (
      metadata.width * metadata.height >
      MAX_IMAGE_PIXELS
    ) {
      throw imageError("Image dimensions are too large.");
    }

    if ((metadata.pages || 1) > 1) {
      throw imageError("Animated images are not supported.");
    }

    // Correct orientation, resize, compress and strip metadata.
    const buffer = await image
      .rotate()
      .resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();

    return {
      buffer,
      contentType: "image/webp",
      extension: ".webp",
      size: buffer.length,
    };
  } catch (error) {
    if (error.status) {
      throw error;
    }

    throw imageError(
      "The selected image is invalid, corrupted, or too large."
    );
  }
}

module.exports = {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_PIXELS,
  MAX_IMAGE_DIMENSION,
  ALLOWED_IMAGE_TYPES,
  processProfileImage,
};
