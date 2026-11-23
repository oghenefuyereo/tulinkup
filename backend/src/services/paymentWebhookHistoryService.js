
"use strict";

// Pure SQL builder for webhook payment history inspection.
// The caller must lock the payment source first.
// Includes all sandbox payment attempts for the source,
// regardless of student ownership, to detect conflicts.
// No database connections or Stripe API requests.

const MAX_ID = 9223372036854775807n;

function normalizeId(value, name) {
  if (
    typeof value !== "string" &&
    !(typeof value === "number" && Number.isSafeInteger(value))
  ) {
    throw new Error("Invalid " + name + ".");
  }

  const id = String(value);

  if (
    !/^[1-9][0-9]{0,18}$/.test(id) ||
    BigInt(id) > MAX_ID
  ) {
    throw new Error("Invalid " + name + ".");
  }

  return id;
}

function buildWebhookPaymentHistoryLookup(
  paymentType,
  sourceId,
  studentId
) {
  if (!["one_on_one", "group"].includes(paymentType)) {
    throw new Error("Unsupported payment type.");
  }

  const id = normalizeId(sourceId, "source ID");

  // Validate the student ID, but do not use it to
  // filter payment history. All payment attempts
  // for this source must remain visible.
  normalizeId(studentId, "student ID");

  const sourceColumn =
    paymentType === "one_on_one"
      ? "booking_id"
      : "enrollment_id";

  return {
    text: `
      SELECT p.*
      FROM public.payments p
      WHERE p.${sourceColumn} = $1
        AND p.payment_type = $2
        AND p.livemode = false
      ORDER BY p.created_at DESC, p.id DESC
    `,
    values: [id, paymentType],
  };
}

module.exports = {
  buildWebhookPaymentHistoryLookup,
};
