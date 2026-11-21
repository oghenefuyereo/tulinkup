// Load the environment variables.
require("dotenv").config();

// Import the Stripe SDK.
const Stripe = require("stripe");

// Get the Stripe secret key from the environment.
const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

// Make sure the Stripe secret key is available.
if (!secretKey) {
  throw new Error("STRIPE_SECRET_KEY is missing.");
}

// Only allow sandbox payments during development.
if (!secretKey.startsWith("sk_test_")) {
  throw new Error(
    "TuLinkUp currently requires a Stripe test secret key."
  );
}

// Initialize the Stripe client.
const stripe = new Stripe(secretKey, {
  maxNetworkRetries: 2,
  timeout: 30000,
});

// Export the Stripe client for payment operations.
module.exports = stripe;