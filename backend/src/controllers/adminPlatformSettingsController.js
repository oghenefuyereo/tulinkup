"use strict";

const {
  getPlatformSettings,
} = require("../services/platformSettingsService");

// Retrieve the current platform configuration for administrators.
async function getAdminPlatformSettings(req, res) {
  res.set("Cache-Control", "no-store");

  if (req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Administrator access is required.",
    });
  }

  if (Object.keys(req.query || {}).length !== 0) {
    return res.status(400).json({
      success: false,
      message: "Query parameters are not supported.",
    });
  }

  try {
    const settings = await getPlatformSettings();

    // Return only the configuration needed by the dashboard.
    return res.status(200).json({
      success: true,
      settings: {
        currency: settings.currency,

        minPrivateHourlyRateCents:
          settings.minPrivateHourlyRateCents,

        maxPrivateHourlyRateCents:
          settings.maxPrivateHourlyRateCents,

        maxPrivateStudents:
          settings.maxPrivateStudents,

        minGroupPriceCents:
          settings.minGroupPriceCents,

        maxGroupPriceCents:
          settings.maxGroupPriceCents,

        minGroupCapacity:
          settings.minGroupCapacity,

        maxGroupStudents:
          settings.maxGroupStudents,

        maxGroupRevenueCents:
          settings.maxGroupRevenueCents,

        platformCommissionPercent:
          settings.platformCommissionPercent,

        tutorRevenuePercent:
          settings.tutorRevenuePercent,

        freeTutoringEnabled:
          settings.freeTutoringEnabled,

        paidTutoringEnabled:
          settings.paidTutoringEnabled,

        tutorTransfersEnabled:
          settings.tutorTransfersEnabled,
      },
    });
  } catch {
    return res.status(503).json({
      success: false,
      message: "Platform settings are currently unavailable.",
    });
  }
}

module.exports = {
  getAdminPlatformSettings,
};
