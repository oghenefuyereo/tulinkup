// Check that numeric settings stay within the supported limits.
function integerBetween(value, minimum, maximum) {
  return Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum;
}

function validObject(value) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function invalid() {
  throw new Error("Invalid platform settings response.");
}

// Validate the settings before exposing them to the dashboard.
export function validateAdminSettingsResponse(data) {
  if (
    !validObject(data) ||
    data.success !== true ||
    !validObject(data.settings)
  ) {
    invalid();
  }

  const settings = data.settings;

  const {
    currency,
    minPrivateHourlyRateCents,
    maxPrivateHourlyRateCents,
    maxPrivateStudents,
    minGroupPriceCents,
    maxGroupPriceCents,
    minGroupCapacity,
    maxGroupStudents,
    maxGroupRevenueCents,
    platformCommissionPercent,
    tutorRevenuePercent,
    freeTutoringEnabled,
    paidTutoringEnabled,
    tutorTransfersEnabled,
  } = settings;

  if (
    currency !== "CAD" ||
    !integerBetween(minPrivateHourlyRateCents, 0, 2500) ||
    !integerBetween(
      maxPrivateHourlyRateCents,
      minPrivateHourlyRateCents,
      2500
    ) ||
    maxPrivateStudents !== 1 ||
    !integerBetween(minGroupPriceCents, 0, 1000) ||
    !integerBetween(
      maxGroupPriceCents,
      minGroupPriceCents,
      1000
    ) ||
    !integerBetween(minGroupCapacity, 2, 20) ||
    !integerBetween(
      maxGroupStudents,
      minGroupCapacity,
      20
    ) ||
    !integerBetween(maxGroupRevenueCents, 0, 10000) ||
    minGroupPriceCents * minGroupCapacity >
      maxGroupRevenueCents ||
    platformCommissionPercent !== 20 ||
    tutorRevenuePercent !== 80 ||
    platformCommissionPercent + tutorRevenuePercent !== 100 ||
    typeof freeTutoringEnabled !== "boolean" ||
    typeof paidTutoringEnabled !== "boolean" ||
    typeof tutorTransfersEnabled !== "boolean"
  ) {
    invalid();
  }

  // Return only the settings administrators need to see.
  return {
    success: true,
    settings: {
      currency,
      minPrivateHourlyRateCents,
      maxPrivateHourlyRateCents,
      maxPrivateStudents,
      minGroupPriceCents,
      maxGroupPriceCents,
      minGroupCapacity,
      maxGroupStudents,
      maxGroupRevenueCents,
      platformCommissionPercent,
      tutorRevenuePercent,
      freeTutoringEnabled,
      paidTutoringEnabled,
      tutorTransfersEnabled,
    },
  };
}
