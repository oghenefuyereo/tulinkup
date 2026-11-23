"use strict";

const {
  buildWebhookPaymentUpdate
} = require("./paymentWebhookUpdateService");

const {
  buildWebhookSourceUpdate
} = require("./paymentWebhookSourceUpdateService");

const {
  buildWebhookGroupAmountUpdate
} = require("./paymentWebhookGroupAmountService");

// Must be called inside an existing transaction after all
// payment, source, eligibility and capacity checks succeed.
// The caller is responsible for COMMIT or ROLLBACK.
async function applyWebhookAtomicUpdate({
  client,
  payment,
  sourceId,
  targetStatus
}) {
  if (!client || typeof client.query !== "function") {
    throw new Error("Transaction client is required.");
  }

  if (!payment || typeof payment !== "object") {
    throw new Error("Payment record is required.");
  }

  if (!["one_on_one", "group"].includes(payment.payment_type)) {
    throw new Error("Unsupported payment type.");
  }

  const paymentUpdate = buildWebhookPaymentUpdate(
    payment.id,
    payment.payment_status,
    targetStatus
  );

  const sourceUpdate = buildWebhookSourceUpdate(
    payment.payment_type,
    sourceId,
    targetStatus
  );

  const paymentResult = await client.query(
    paymentUpdate.text,
    paymentUpdate.values
  );

  if (
    !paymentResult ||
    !Array.isArray(paymentResult.rows) ||
    paymentResult.rows.length !== 1
  ) {
    throw new Error("Payment update failed; rollback required.");
  }

  const updatedPayment = paymentResult.rows[0];

  if (
    !updatedPayment ||
    String(updatedPayment.id) !== String(payment.id) ||
    updatedPayment.payment_status !== targetStatus
  ) {
    throw new Error(
      "Payment update returned inconsistent data; rollback required."
    );
  }

  const sourceResult = await client.query(
    sourceUpdate.text,
    sourceUpdate.values
  );

  if (
    !sourceResult ||
    !Array.isArray(sourceResult.rows) ||
    sourceResult.rows.length !== 1
  ) {
    throw new Error("Source update failed; rollback required.");
  }

  const updatedSource = sourceResult.rows[0];

  const expectedSourceStatus =
    targetStatus === "paid"
      ? "paid"
      : targetStatus === "failed"
        ? "failed"
        : targetStatus === "expired"
          ? "unpaid"
          : "pending";

  if (
    !updatedSource ||
    String(updatedSource.id) !== String(sourceId) ||
    updatedSource.payment_status !== expectedSourceStatus
  ) {
    throw new Error(
      "Source update returned inconsistent data; rollback required."
    );
  }

  if (
    payment.payment_type === "group" &&
    targetStatus === "paid" &&
    updatedSource.enrollment_status !== "confirmed"
  ) {
    throw new Error(
      "Group enrollment confirmation mismatch; rollback required."
    );
  }

  if (
    payment.payment_type === "one_on_one" &&
    updatedSource.status !== "pending"
  ) {
    throw new Error(
      "Booking status mismatch; rollback required."
    );
  }

  if (
    payment.payment_type === "group" &&
    targetStatus === "paid"
  ) {
    const amountUpdate = buildWebhookGroupAmountUpdate(
      sourceId,
      Number(payment.amount_cents)
    );

    const amountResult = await client.query(
      amountUpdate.text,
      amountUpdate.values
    );

    if (
      !amountResult ||
      !Array.isArray(amountResult.rows) ||
      amountResult.rows.length !== 1
    ) {
      throw new Error(
        "Group payment amount update failed; rollback required."
      );
    }

    const updatedAmount = amountResult.rows[0];

    if (
      !updatedAmount ||
      String(updatedAmount.id) !== String(sourceId) ||
      Number(updatedAmount.amount_paid_cents) !==
        Number(payment.amount_cents)
    ) {
      throw new Error(
        "Group payment amount mismatch; rollback required."
      );
    }
  }

  return {
    action: "applied",
    paymentId: String(payment.id),
    paymentType: payment.payment_type,
    paymentStatus: targetStatus
  };
}

module.exports = {
  applyWebhookAtomicUpdate
};
