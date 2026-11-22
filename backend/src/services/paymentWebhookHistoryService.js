"use strict";

// Pure SQL builder for webhook payment history inspection.
// The caller must lock the payment source first.
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
  const ownerId = normalizeId(studentId, "student ID");

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
        AND p.student_id = $3
        AND p.livemode = false
      ORDER BY p.created_at DESC, p.id DESC
    `,
    values: [id, paymentType, ownerId],
  };
}

module.exports = {
  buildWebhookPaymentHistoryLookup,
};
