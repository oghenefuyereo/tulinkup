"use strict";

const {
  updateTutorApproval,
} = require("../services/adminTutorApprovalService");

// Return only safe messages for expected approval errors.
function sendApprovalError(res, error) {
  const messages = {
    400: "Invalid tutor approval request.",
    403: "Active administrator access required.",
    404: "Tutor profile or account not found.",
    409: "The approval decision conflicts with the current tutor status. Refresh and try again.",
  };

  if (Object.hasOwn(messages, error.statusCode)) {
    return res.status(error.statusCode).json({
      success: false,
      error: messages[error.statusCode],
    });
  }

  if (error.code === "ADMIN_COMMIT_UNCERTAIN") {
    return res.status(503).json({
      success: false,
      code: "ADMIN_COMMIT_UNCERTAIN",
      error: "The approval outcome requires verification. Refresh before trying again.",
    });
  }

  console.error("Administrator tutor approval failed.");

  return res.status(503).json({
    success: false,
    error: "Tutor approval temporarily unavailable.",
  });
}

// Allow an administrator to approve or reject a tutor profile.
async function changeTutorApproval(req, res) {
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
      error: "Invalid tutor approval request.",
    });
  }

  const allowedFields = [
    "status",
    "expectedStatus",
    "reason",
  ];

  const keys = Reflect.ownKeys(body);
  const data = Object.create(null);

  // Reject unsupported fields and read only ordinary request values.
  if (keys.length !== allowedFields.length) {
    return res.status(400).json({
      success: false,
      error: "Status, expected status and reason are required.",
    });
  }

  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(
      body,
      key
    );

    if (
      !allowedFields.includes(key) ||
      !descriptor.enumerable ||
      !Object.hasOwn(descriptor, "value")
    ) {
      return res.status(400).json({
        success: false,
        error: "Unsupported approval field.",
      });
    }

    data[key] = descriptor.value;
  }

  try {
    // Use the authenticated administrator rather than a supplied ID.
    const approval = await updateTutorApproval({
      adminId: req.user.userId,
      profileId: req.params.profileId,
      status: data.status,
      expectedStatus: data.expectedStatus,
      reason: data.reason,
    });

    return res.status(200).json({
      success: true,
      approval,
    });
  } catch (error) {
    return sendApprovalError(res, error);
  }
}

module.exports = {
  changeTutorApproval,
};
