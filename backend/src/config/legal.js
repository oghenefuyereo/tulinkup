"use strict";

// Versions must match the documents displayed to users.
const TERMS_VERSION = "1.0-draft";
const PRIVACY_VERSION = "1.0-draft";

const REGISTRATION_METHODS = Object.freeze([
  "email",
  "google",
  "github"
]);

module.exports = Object.freeze({
  TERMS_VERSION,
  PRIVACY_VERSION,
  REGISTRATION_METHODS
});
