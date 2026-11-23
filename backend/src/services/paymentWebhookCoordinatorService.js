
"use strict";

// TuLinkUp webhook reconciliation coordinator.
// Preparation phase: read and validate only.
// No payment or booking updates are performed.

const {
  withPaymentTransaction,
  lockBooking,
  lockGroupEnrollment,
} = require("./paymentTransactionService");

const {
  validateWebhookCheckoutEvent,
} = require("./paymentWebhookReconciliationService");

const {
  buildWebhookPaymentLookup,
} = require("./paymentWebhookLookupService");

const {
  buildWebhookPaymentHistoryLookup,
} = require("./paymentWebhookHistoryService");

const {
  decideWebhookPaymentHistory,
} = require("./paymentWebhookHistoryDecisionService");

const {
  lockWebhookPayment,
} = require("./paymentWebhookLockService");

const {
  verifyWebhookPaymentReferences,
} = require("./paymentWebhookReferenceService");

const {
  verifyPersistedCheckoutSession,
} = require("./paymentWebhookSafetyService");

const {
  verifyWebhookFinancialSnapshot,
} = require("./paymentWebhookFinancialService");

function sourceIdForPayment(payment) {
  if (payment.payment_type === "one_on_one") {
    return payment.booking_id;
  }

  if (payment.payment_type === "group") {
    return payment.enrollment_id;
  }

  throw new Error("Unsupported webhook payment type.");
}

async function prepareWebhookReconciliation(
  event,
  database
) {
  const validated = validateWebhookCheckoutEvent(event);

  if (!database || typeof database.connect !== "function") {
    throw new Error(
      "An explicitly supplied test database is required."
    );
  }

  return withPaymentTransaction(async (client) => {
    const lookup = buildWebhookPaymentLookup(
      validated.paymentId
    );

    const initial = await client.query(
      lookup.text,
      lookup.values
    );

    if (!initial.rows || initial.rows.length !== 1) {
      throw new Error("Webhook payment not found.");
    }

    const candidate = initial.rows[0];
    const sourceId = sourceIdForPayment(candidate);

    let source;

    if (candidate.payment_type === "one_on_one") {
      source = await lockBooking(
        sourceId,
        candidate.student_id,
        client
      );
    } else {
      const locked = await lockGroupEnrollment(
        sourceId,
        candidate.student_id,
        client
      );

      source = {
        ...locked.enrollment,
        groupClass: locked.groupClass,
      };
    }

    const historyLookup =
      buildWebhookPaymentHistoryLookup(
        candidate.payment_type,
        sourceId,
        candidate.student_id
      );

    const historyResult = await client.query(
      historyLookup.text,
      historyLookup.values
    );

    if (!Array.isArray(historyResult.rows)) {
      throw new Error("Invalid webhook payment history.");
    }

    // Verify ownership and source references for every
    // historical payment before making a history decision.
    for (const historicalPayment of historyResult.rows) {
      if (
        !historicalPayment ||
        typeof historicalPayment !== "object" ||
        String(historicalPayment.student_id ?? "") !==
          String(source.student_id) ||
        String(historicalPayment.tutor_id ?? "") !==
          String(
            candidate.payment_type === "one_on_one"
              ? source.tutor_id
              : source.groupClass?.tutor_id
          ) ||
        historicalPayment.payment_type !==
          candidate.payment_type ||
        String(sourceIdForPayment(historicalPayment)) !==
          String(sourceId)
      ) {
        throw new Error(
          "Webhook payment history ownership or reference mismatch."
        );
      }
    }

    const historyDecision =
      decideWebhookPaymentHistory(
        validated.paymentId,
        historyResult.rows
      );

    if (historyDecision.action !== "continue") {
      return {
        action: "manual_review",
        reason: historyDecision.reason,
      };
    }

    const payment = await lockWebhookPayment(
      validated.paymentId,
      client
    );

    if (
      String(payment.id) !== String(candidate.id) ||
      payment.payment_type !== candidate.payment_type ||
      String(payment.student_id) !==
        String(candidate.student_id) ||
      String(sourceIdForPayment(payment)) !==
        String(sourceId)
    ) {
      throw new Error(
        "Webhook payment references changed during locking."
      );
    }

    verifyWebhookPaymentReferences(payment, source);

    verifyPersistedCheckoutSession(
      payment,
      validated.session
    );

    verifyWebhookFinancialSnapshot(
      payment,
      validated.session,
      source
    );

    return {
      action: "prepared",
      paymentId: String(payment.id),
      paymentStatus: payment.payment_status,
      paymentType: payment.payment_type,
    };
  }, database);
}

module.exports = {
  prepareWebhookReconciliation,
};
