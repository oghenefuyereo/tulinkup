const pool = require("../config/db");

// Convert and validate the database configuration.
function normalizePlatformSettings(row) {
  if (!row) {
    throw new Error("Platform settings not found.");
  }

  const settings = {
    id: row.id,
    currency: row.currency,

    minPrivateHourlyRateCents:
      row.min_private_hourly_rate_cents,

    maxPrivateHourlyRateCents:
      row.max_private_hourly_rate_cents,

    maxPrivateStudents:
      row.max_private_students,

    minGroupPriceCents:
      row.min_group_price_cents,

    maxGroupPriceCents:
      row.max_group_price_cents,

    minGroupCapacity:
      row.min_group_capacity,

    maxGroupStudents:
      row.max_group_students,

    maxGroupRevenueCents:
      row.max_group_revenue_cents,

    platformCommissionPercent:
      Number(row.platform_commission_percent),

    tutorRevenuePercent:
      Number(row.tutor_revenue_percent),

    freeTutoringEnabled:
      row.free_tutoring_enabled,

    paidTutoringEnabled:
      row.paid_tutoring_enabled,

    tutorTransfersEnabled:
      row.tutor_transfers_enabled,

    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  validatePlatformSettings(settings);

  return Object.freeze(settings);
}

// Validate integer settings within an allowed range.
function validateInteger(value, minimum, maximum, name) {
  if (
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(`Invalid platform setting: ${name}.`);
  }
}

// Validate the platform pricing and payment configuration.
function validatePlatformSettings(settings) {
  if (settings.id !== 1) {
    throw new Error("Invalid platform settings ID.");
  }

  if (settings.currency !== "CAD") {
    throw new Error("Unsupported platform currency.");
  }

  validateInteger(
    settings.minPrivateHourlyRateCents,
    0,
    2500,
    "minimum private hourly rate"
  );

  validateInteger(
    settings.maxPrivateHourlyRateCents,
    settings.minPrivateHourlyRateCents,
    2500,
    "maximum private hourly rate"
  );

  if (settings.maxPrivateStudents !== 1) {
    throw new Error(
      "Private tutoring must support exactly one student."
    );
  }

  validateInteger(
    settings.minGroupPriceCents,
    0,
    1000,
    "minimum group price"
  );

  validateInteger(
    settings.maxGroupPriceCents,
    settings.minGroupPriceCents,
    1000,
    "maximum group price"
  );

  validateInteger(
    settings.minGroupCapacity,
    2,
    20,
    "minimum group capacity"
  );

  validateInteger(
    settings.maxGroupStudents,
    settings.minGroupCapacity,
    20,
    "maximum group students"
  );

  validateInteger(
    settings.maxGroupRevenueCents,
    0,
    10000,
    "maximum group revenue"
  );

  if (
    settings.minGroupPriceCents *
      settings.minGroupCapacity >
    settings.maxGroupRevenueCents
  ) {
    throw new Error(
      "Minimum group pricing exceeds the maximum group revenue."
    );
  }

  if (settings.platformCommissionPercent !== 20) {
    throw new Error(
      "The platform commission must currently be 20 percent."
    );
  }

  if (settings.tutorRevenuePercent !== 80) {
    throw new Error(
      "The tutor revenue share must currently be 80 percent."
    );
  }

  if (
    settings.platformCommissionPercent +
      settings.tutorRevenuePercent !==
    100
  ) {
    throw new Error("Invalid platform revenue split.");
  }

  const featureFlags = [
    settings.freeTutoringEnabled,
    settings.paidTutoringEnabled,
    settings.tutorTransfersEnabled,
  ];

  if (
    featureFlags.some(
      (value) => typeof value !== "boolean"
    )
  ) {
    throw new Error("Invalid platform payment configuration.");
  }

  return true;
}

// Retrieve the current platform settings from PostgreSQL.
async function getPlatformSettings(db = pool) {
  const result = await db.query(
    `
      SELECT *
      FROM public.platform_settings
      WHERE id = $1
    `,
    [1]
  );

  if (result.rows.length !== 1) {
    throw new Error("Platform settings not found.");
  }

  return normalizePlatformSettings(result.rows[0]);
}

module.exports = {
  getPlatformSettings,
  normalizePlatformSettings,
  validatePlatformSettings,
};