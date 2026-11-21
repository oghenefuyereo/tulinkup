const pool = require("../config/db");

const {
  validateId,
  withPaymentTransaction,
} = require("./paymentTransactionService");

const {
  verifyCheckoutSession,
} = require("./stripeCheckoutService");

/**
 * Persist a verified sandbox Checkout Session against
 * an existing pending payment.
 *
 * The session must have been obtained from Stripe by a
 * trusted server-side service, not from client input.
 */
async function persistCheckoutSession(
  paymentId,
  session,
  user,
  database = pool
) {
  const id = validateId(paymentId, "payment ID");

  if (!user || user.role !== "student" || !user.userId) {
    const error = new Error("Student authentication required.");
    error.statusCode = 403;
    throw error;
  }

  const studentId = validateId(user.userId, "student ID");

  return withPaymentTransaction(async (client) => {
    const result = await client.query(
      `
      SELECT p.*
      FROM public.payments AS p
      JOIN public.users AS u
        ON u.id = p.student_id
      WHERE p.id = $1
        AND p.student_id = $2
        AND u.role = 'student'
        AND p.livemode = false
      FOR UPDATE OF p
      `,
      [id, studentId]
    );

    if (result.rows.length !== 1) {
      const error = new Error("Payment not found.");
      error.statusCode = 404;
      throw error;
    }

    const payment = result.rows[0];

    if (payment.payment_status !== "pending") {
      const error = new Error(
        "Only pending payments can store Checkout sessions."
      );
      error.statusCode = 409;
      throw error;
    }

    // Verify the session's amount, currency, metadata,
    // payment reference, and sandbox environment.
    verifyCheckoutSession(session, payment);

    if (
      session.status !== "open" ||
      session.payment_status !== "unpaid" ||
      !Number.isSafeInteger(session.expires_at) ||
      session.expires_at <= Math.floor(Date.now() / 1000)
    ) {
      const error = new Error(
        "Checkout Session is not open and unpaid."
      );
      error.statusCode = 409;
      throw error;
    }

    // An existing association may only be reused.
    if (payment.stripe_checkout_session_id) {
      if (payment.stripe_checkout_session_id !== session.id) {
        const error = new Error(
          "Payment already has a different Checkout Session."
        );
        error.statusCode = 409;
        throw error;
      }

      return {
        action: "reuse",
        payment,
      };
    }

    const updated = await client.query(
      `
      UPDATE public.payments
      SET stripe_checkout_session_id = $1,
          updated_at = NOW()
      WHERE id = $2
        AND student_id = $3
        AND payment_status = 'pending'
        AND livemode = false
        AND stripe_checkout_session_id IS NULL
      RETURNING *
      `,
      [session.id, id, studentId]
    );

    if (updated.rows.length !== 1) {
      throw new Error(
        "Checkout Session association could not be saved."
      );
    }

    return {
      action: "stored",
      payment: updated.rows[0],
    };
  }, database);
}

module.exports = {
  persistCheckoutSession,
};
