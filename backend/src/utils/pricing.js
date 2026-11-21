// TuLinkUp pricing rules. All amounts are in Canadian cents.

const {
  getPlatformSettings,
} = require("../services/platformSettingsService");

const PRICING = Object.freeze({
  CURRENCY: "CAD",

  // Private tutoring
  MIN_PRIVATE_HOURLY_RATE_CENTS: 0,
  MAX_PRIVATE_HOURLY_RATE_CENTS: 2500,
  PRIVATE_MAX_STUDENTS: 1,

  // Group live classes
  MIN_GROUP_PRICE_CENTS: 0,
  MIN_GROUP_CAPACITY: 2,
  MAX_GROUP_PRICE_CENTS: 1000,
  MAX_GROUP_STUDENTS: 20,
  MAX_GROUP_REVENUE_CENTS: 10000,

  // Revenue distribution
  PLATFORM_COMMISSION_PERCENT: 20,
  TUTOR_REVENUE_PERCENT: 80,

  // Payment feature controls
  FREE_TUTORING_ENABLED: true,
  PAID_TUTORING_ENABLED: false,
  TUTOR_TRANSFERS_ENABLED: false,
});

// Retrieve the current pricing configuration from the database.
async function getPricingConfig(db) {
  const settings = await getPlatformSettings(db);

  return Object.freeze({
    CURRENCY: settings.currency,

    MIN_PRIVATE_HOURLY_RATE_CENTS:
      settings.minPrivateHourlyRateCents,

    MAX_PRIVATE_HOURLY_RATE_CENTS:
      settings.maxPrivateHourlyRateCents,

    PRIVATE_MAX_STUDENTS:
      settings.maxPrivateStudents,

    MIN_GROUP_PRICE_CENTS:
      settings.minGroupPriceCents,

    MIN_GROUP_CAPACITY:
      settings.minGroupCapacity,

    MAX_GROUP_PRICE_CENTS:
      settings.maxGroupPriceCents,

    MAX_GROUP_STUDENTS:
      settings.maxGroupStudents,

    MAX_GROUP_REVENUE_CENTS:
      settings.maxGroupRevenueCents,

    PLATFORM_COMMISSION_PERCENT:
      settings.platformCommissionPercent,

    TUTOR_REVENUE_PERCENT:
      settings.tutorRevenuePercent,

    FREE_TUTORING_ENABLED:
      settings.freeTutoringEnabled,

    PAID_TUTORING_ENABLED:
      settings.paidTutoringEnabled,

    TUTOR_TRANSFERS_ENABLED:
      settings.tutorTransfersEnabled,
  });
}

// Check that the amount is within the allowed range.
function validateAmount(amount, maximum, minimum = 0) {
  if (
    !Number.isSafeInteger(minimum) ||
    !Number.isSafeInteger(maximum) ||
    minimum < 0 ||
    maximum < minimum
  ) {
    throw new Error("Invalid pricing limits.");
  }

  if (
    !Number.isSafeInteger(amount) ||
    amount < minimum ||
    amount > maximum
  ) {
    throw new Error(
      `Amount must be between ${minimum} and ${maximum} cents.`
    );
  }
}

// Validate a private tutoring hourly rate.
function validatePrivatePricing(
  hourlyRateCents,
  pricing = PRICING
) {
  validateAmount(
    hourlyRateCents,
    pricing.MAX_PRIVATE_HOURLY_RATE_CENTS,
    pricing.MIN_PRIVATE_HOURLY_RATE_CENTS
  );

  return true;
}

// Calculate how many students can join at the selected price.
function getMaximumGroupStudents(
  priceCents,
  pricing = PRICING
) {
  validateAmount(
    priceCents,
    pricing.MAX_GROUP_PRICE_CENTS,
    pricing.MIN_GROUP_PRICE_CENTS
  );

  // Free classes can use the maximum configured capacity.
  if (priceCents === 0) {
    return pricing.MAX_GROUP_STUDENTS;
  }

  return Math.min(
    pricing.MAX_GROUP_STUDENTS,
    Math.floor(
      pricing.MAX_GROUP_REVENUE_CENTS / priceCents
    )
  );
}

// Check the group class price and student capacity.
function validateGroupPricing(
  priceCents,
  minimumStudents,
  maximumStudents,
  pricing = PRICING
) {
  const allowedMaximum = getMaximumGroupStudents(
    priceCents,
    pricing
  );

  if (allowedMaximum < pricing.MIN_GROUP_CAPACITY) {
    throw new Error(
      "The selected price does not support the minimum group capacity."
    );
  }

  if (
    !Number.isInteger(maximumStudents) ||
    maximumStudents < pricing.MIN_GROUP_CAPACITY ||
    maximumStudents > allowedMaximum
  ) {
    throw new Error(
      `Maximum students must be between ${pricing.MIN_GROUP_CAPACITY} and ${allowedMaximum} at this price.`
    );
  }

  if (
    !Number.isInteger(minimumStudents) ||
    minimumStudents < 1 ||
    minimumStudents > maximumStudents
  ) {
    throw new Error(
      "Minimum students must be between 1 and the maximum capacity."
    );
  }

  return true;
}

// Calculate the private session price based on its duration.
function calculatePrivateSessionPrice(
  hourlyRateCents,
  durationMinutes,
  pricing = PRICING
) {
  validatePrivatePricing(hourlyRateCents, pricing);

  // These durations match the bookings table.
  const allowedDurations = [30, 60, 90];

  if (!allowedDurations.includes(durationMinutes)) {
    throw new Error("Invalid session duration.");
  }

  return Math.round(
    (hourlyRateCents * durationMinutes) / 60
  );
}

// Calculate the commission and tutor earnings before fees and taxes.
function calculateRevenueSplit(
  grossAmountCents,
  pricing = PRICING
) {
  if (
    !Number.isSafeInteger(grossAmountCents) ||
    grossAmountCents < 0
  ) {
    throw new Error("Invalid gross revenue amount.");
  }

  const commissionPercent =
    pricing.PLATFORM_COMMISSION_PERCENT;

  const tutorPercent =
    pricing.TUTOR_REVENUE_PERCENT;

  if (
    commissionPercent !== 20 ||
    tutorPercent !== 80
  ) {
    throw new Error("Invalid platform revenue split.");
  }

  // Calculate commission without multiplying large integers.
  const platformCommissionCents =
    Math.floor(grossAmountCents / 5) +
    Math.round((grossAmountCents % 5) / 5);

  const tutorEarningsCents =
    grossAmountCents - platformCommissionCents;

  return {
    grossAmountCents,
    platformCommissionCents,
    tutorEarningsCents,
    currency: pricing.CURRENCY,
  };
}

// Calculate potential earnings when a group class is full.
function calculateGroupRevenue(
  priceCents,
  maximumStudents,
  pricing = PRICING
) {
  validateGroupPricing(
    priceCents,
    1,
    maximumStudents,
    pricing
  );

  // Calculate commission separately for each student payment.
  const studentRevenue = calculateRevenueSplit(
    priceCents,
    pricing
  );

  return {
    grossAmountCents:
      priceCents * maximumStudents,

    platformCommissionCents:
      studentRevenue.platformCommissionCents *
      maximumStudents,

    tutorEarningsCents:
      studentRevenue.tutorEarningsCents *
      maximumStudents,

    currency: pricing.CURRENCY,
  };
}

// Determine whether a new tutoring session is permitted.
function validatePaymentAvailability(
  amountCents,
  pricing
) {
  if (
    !Number.isSafeInteger(amountCents) ||
    amountCents < 0
  ) {
    throw new Error("Invalid payment amount.");
  }

  if (
    !pricing ||
    typeof pricing.FREE_TUTORING_ENABLED !== "boolean" ||
    typeof pricing.PAID_TUTORING_ENABLED !== "boolean"
  ) {
    throw new Error(
      "Payment configuration is unavailable."
    );
  }

  if (
    amountCents === 0 &&
    !pricing.FREE_TUTORING_ENABLED
  ) {
    throw new Error(
      "Free tutoring is currently unavailable."
    );
  }

  if (
    amountCents > 0 &&
    !pricing.PAID_TUTORING_ENABLED
  ) {
    throw new Error(
      "Paid tutoring is currently unavailable."
    );
  }

  return true;
}

// Determine the initial payment status for a new session.
function getInitialPaymentStatus(
  amountCents,
  pricing
) {
  validatePaymentAvailability(
    amountCents,
    pricing
  );

  return amountCents === 0
    ? "not_required"
    : "unpaid";
}

// Check whether tutor transfers are enabled.
function validateTransferAvailability(pricing) {
  if (
    !pricing ||
    pricing.TUTOR_TRANSFERS_ENABLED !== true
  ) {
    throw new Error(
      "Tutor transfers are currently unavailable."
    );
  }

  return true;
}

module.exports = {
  PRICING,
  getPricingConfig,
  validateAmount,
  validatePrivatePricing,
  getMaximumGroupStudents,
  validateGroupPricing,
  calculatePrivateSessionPrice,
  calculateRevenueSplit,
  calculateGroupRevenue,
  validatePaymentAvailability,
  getInitialPaymentStatus,
  validateTransferAvailability,
};