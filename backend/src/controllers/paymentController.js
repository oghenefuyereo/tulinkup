// Student payment Checkout controller.
// All payment amounts come from trusted backend services.

const {
  preparePayment,
} = require("../services/paymentPreparationService");

const {
  createCheckoutSession,
} = require("../services/stripeCheckoutService");

const {
  persistCheckoutSession,
} = require("../services/paymentCheckoutPersistenceService");

function fail(res, status, message) {
  return res.status(status).json({
    success: false,
    message,
  });
}

async function startCheckout(req, res) {
  res.set("Cache-Control", "no-store");

  try {
    if (!req.user?.userId) {
      return fail(res, 401, "Authentication required.");
    }

    if (req.user.role !== "student") {
      return fail(res, 403, "Only students can make payments.");
    }

    const { paymentType, sourceId } = req.body || {};

    if (
      !["one_on_one", "group"].includes(paymentType) ||
      !/^[1-9]\d*$/.test(String(sourceId ?? ""))
    ) {
      return fail(res, 400, "Invalid payment request.");
    }

    // Create or reuse the payment using trusted database data.
    const prepared = await preparePayment(
      paymentType,
      sourceId,
      req.user
    );

    if (
      !prepared ||
      !["create", "reuse"].includes(prepared.action) ||
      !prepared.payment ||
      !prepared.stripeVerificationRequired
    ) {
      throw new Error("Unexpected payment preparation result.");
    }

    const payment = prepared.payment;

    if (payment.payment_status !== "pending") {
      return fail(res, 409, "Payment is not pending.");
    }

    if (payment.livemode !== false) {
      return fail(res, 409, "Live payments are disabled.");
    }

    // Only the backend communicates with Stripe.
    const session = await createCheckoutSession(payment);

    // Save the Stripe-returned session, not client-supplied data.
    const persisted = await persistCheckoutSession(
      payment.id,
      session,
      req.user
    );

    if (
      !persisted ||
      !["stored", "reuse"].includes(persisted.action) ||
      String(persisted.payment?.id) !== String(payment.id) ||
      persisted.payment?.stripe_checkout_session_id !== session.id
    ) {
      throw new Error("Checkout persistence verification failed.");
    }

    if (
      session.status !== "open" ||
      session.payment_status !== "unpaid" ||
      !Number.isSafeInteger(session.expires_at) ||
      session.expires_at <= Math.floor(Date.now() / 1000) ||
      typeof session.url !== "string" ||
      !/^https:\/\/checkout\.stripe\.com\//.test(session.url)
    ) {
      throw new Error("Checkout session is unavailable.");
    }

    return res.status(200).json({
      success: true,
      paymentId: String(payment.id),
      checkoutUrl: session.url,
      checkoutSessionId: session.id,
      paymentStatus: "pending",
    });
  } catch (error) {
    const status = [400, 401, 403, 404, 409].includes(
      error.statusCode
    )
      ? error.statusCode
      : 500;

    if (status === 500) {
      console.error("Payment Checkout failed:", {
        code: error.code || null,
        type: error.type || error.name || "Error",
      });

      return fail(
        res,
        500,
        "Unable to start Checkout. Please try again later."
      );
    }

    return fail(res, status, error.message);
  }
}

module.exports = {
  startCheckout,
};
