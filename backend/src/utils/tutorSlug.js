"use strict";

// Generate the canonical public tutor profile URL slug.
function makeSlug(fullName, userId) {
  // Convert the name to lowercase and remove special characters.
  const base = String(fullName || "tutor")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Add the user ID so tutors with similar names have different URLs.
  return `${base || "tutor"}-${userId}`;
}

module.exports = { makeSlug };
