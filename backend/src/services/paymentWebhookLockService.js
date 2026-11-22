"use strict";

// Lock a webhook payment only after its booking or enrollment
// has been locked in the same transaction.

const {
  validateId,
  validateTransactionClient,
} = require("./paymentTransactionService");

async function lockWebhookPayment(paymentId, client) {
  const id = validateId(paymentId, "Payment ID");

  validateTransactionClient(client);

  const result = await client.query(
    `SELECT p.*
     FROM public.payments p
     WHERE p.id = $1
       AND p.livemode = false
     FOR UPDATE OF p`,
    [id]
  );

  if (!result.rows || result.rows.length !== 1) {
    throw new Error("Webhook payment record not found.");
  }

  const payment = result.rows[0];

  if (payment.livemode !== false) {
    throw new Error("Live payment cannot be reconciled in sandbox.");
  }

  return payment;
}

module.exports = {
  lockWebhookPayment,
};
