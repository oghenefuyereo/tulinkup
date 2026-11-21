// TuLinkUp Stripe webhook controller.
// Verify signatures before trusting incoming events.
// Payment updates will be implemented separately.

const stripe = require("../config/stripe");

const SUPPORTED_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

async function handleStripeWebhook(req, res) {
  res.set("Cache-Control", "no-store");

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers["stripe-signature"];

  if (
    typeof secret !== "string" ||
    !secret.startsWith("whsec_")
  ) {
    console.error("Stripe webhook configuration missing.");
    return res.status(503).json({
      success: false,
      message: "Webhook unavailable.",
    });
  }

  if (
    typeof signature !== "string" ||
    !signature.trim() ||
    !Buffer.isBuffer(req.body)
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid webhook request.",
    });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      secret
    );
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Webhook signature verification failed.",
    });
  }

  if (!event || event.livemode !== false) {
    return res.status(400).json({
      success: false,
      message: "Unsupported Stripe environment.",
    });
  }

  if (!SUPPORTED_EVENTS.has(event.type)) {
    return res.status(200).json({
      received: true,
    });
  }

  // Do not acknowledge payment events as processed until
  // the database reconciliation handler is implemented.
  // Stripe can retry these events later.
  console.error("Stripe payment event handler not ready:", {
    type: event.type,
  });

  return res.status(503).json({
    success: false,
    message: "Payment event processing unavailable.",
  });
}

module.exports = {
  handleStripeWebhook,
};
