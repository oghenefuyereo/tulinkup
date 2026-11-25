"use strict";

const {
  updateAccountStatus,
} = require("../services/adminAccountStatusService");

// Return safe messages without exposing database errors.
function sendAccountStatusError(res, error) {
  const messages = {
    400: "Invalid account status request.",
    403: "Administrator access required or action prohibited.",
    404: "Student or tutor account not found.",
    409: "Account status conflict. Refresh before trying again.",
  };

  if (error.code === "ADMIN_COMMIT_UNCERTAIN") {
    return res.status(503).json({
      success: false,
      code: "ADMIN_COMMIT_UNCERTAIN",
      error: "The account status outcome requires verification. Refresh before retrying.",
    });
  }

  if (Object.hasOwn(messages, error.statusCode)) {
    return res.status(error.statusCode).json({
      success: false,
      error: messages[error.statusCode],
    });
  }

  console.error("Administrator account status update failed.");

  return res.status(503).json({
    success: false,
    error: "Account management temporarily unavailable. Refresh before retrying.",
  });
}

// Allow administrators to manage student and tutor account access.
async function changeAccountStatus(req, res) {
  res.set("Cache-Control", "no-store");

  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      error: "Administrator access required.",
    });
  }

  if (!req.is("application/json")) {
    return res.status(415).json({
      success: false,
      error: "An application/json request is required.",
    });
  }

  if (Object.keys(req.query).length !== 0) {
    return res.status(400).json({
      success: false,
      error: "Query parameters are not supported.",
    });
  }

  const body = req.body;

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    (
      Object.getPrototypeOf(body) !== Object.prototype &&
      Object.getPrototypeOf(body) !== null
    )
  ) {
    return res.status(400).json({
      success: false,
      error: "Invalid account status request.",
    });
  }

  const allowedFields = [
    "status",
    "expectedStatus",
    "reason",
  ];

  const keys = Reflect.ownKeys(body);
  const data = Object.create(null);

  if (keys.length !== allowedFields.length) {
    return res.status(400).json({
      success: false,
      error: "Status, expected status and reason are required.",
    });
  }

  for (const key of keys) {
    const descriptor =
      Object.getOwnPropertyDescriptor(body, key);

    if (
      !allowedFields.includes(key) ||
      !descriptor.enumerable ||
      !Object.hasOwn(descriptor, "value")
    ) {
      return res.status(400).json({
        success: false,
        error: "Unsupported account status field.",
      });
    }

    data[key] = descriptor.value;
  }

  try {
    const account = await updateAccountStatus({
      adminId: req.user.userId,
      userId: req.params.userId,
      status: data.status,
      expectedStatus: data.expectedStatus,
      reason: data.reason,
    });

    return res.status(200).json({
      success: true,
      account,
    });

  } catch (error) {
    return sendAccountStatusError(res, error);
  }
}

module.exports = {
  changeAccountStatus,
};
