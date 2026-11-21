const { PRICING } = require("./pricing");

const MINIMUM_CHARGE_CENTS = 50;

const PAYMENT_TYPES = Object.freeze([
  "one_on_one",
  "group",
]);

// Validate a positive tutoring payment amount.
function validatePaymentAmount(
  amountCents,
  paymentType
) {
  if (!PAYMENT_TYPES.includes(paymentType)) {
    throw new Error("Invalid payment type.");
  }

  if (
    !Number.isSafeInteger(amountCents) ||
    amountCents <= 0
  ) {
    throw new Error("Invalid payment amount.");
  }

  if (amountCents < MINIMUM_CHARGE_CENTS) {
    throw new Error(
      "The minimum Checkout payment is CAD $0.50."
    );
  }

  const maximumAmount =
    paymentType === "one_on_one"
      ? Math.round(
          (
            PRICING.MAX_PRIVATE_HOURLY_RATE_CENTS *
            90
          ) / 60
        )
      : PRICING.MAX_GROUP_PRICE_CENTS;

  if (amountCents > maximumAmount) {
    throw new Error(
      "Payment exceeds the allowed tutoring amount."
    );
  }

  return true;
}

module.exports = {
  validatePaymentAmount,
};