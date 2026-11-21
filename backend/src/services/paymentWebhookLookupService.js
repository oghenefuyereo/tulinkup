"use strict";

// TuLinkUp webhook payment lookup.
// Builds parameterized SQL without connecting to PostgreSQL.

const {
  validateId,
} = require("./paymentTransactionService");

function buildWebhookPaymentLookup(paymentId) {
  const id = validateId(paymentId, "Payment ID");

  return {
    text: `
      SELECT p.*
      FROM public.payments p
      WHERE p.id = $1
        AND p.livemode = false
      LIMIT 1
    `,
    values: [id],
  };
}

module.exports = {
  buildWebhookPaymentLookup,
};
