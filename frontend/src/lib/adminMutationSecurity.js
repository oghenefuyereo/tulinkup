function validId(value) {
  return typeof value === "string" &&
    /^[1-9]\d{0,18}$/.test(value) &&
    BigInt(value) <= 9223372036854775807n;
}

function validObject(value) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value);
}

// Accept only explicitly configured application origins.
export function isTrustedAdminOrigin(request) {
  const origin = request.headers.get("origin");

  if (
    !origin ||
    origin === "null" ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    return false;
  }

  try {
    const parsed = new URL(origin);

    if (
      parsed.origin !== origin ||
      !["http:", "https:"].includes(parsed.protocol)
    ) {
      return false;
    }

    const localHosts = ["localhost", "127.0.0.1", "[::1]"];
    const configured = process.env.ADMIN_ALLOWED_ORIGINS;

    // Require HTTPS for configured public origins.
    if (configured !== undefined) {
      const allowed = configured
        .split(",")
        .map(value => value.trim())
        .filter(Boolean);

      return allowed.includes(origin) &&
        (
          parsed.protocol === "https:" ||
          (
            process.env.VERCEL !== "1" &&
            localHosts.includes(parsed.hostname)
          )
        );
    }

    // Deployed applications must configure trusted origins.
    if (process.env.VERCEL === "1") {
      return false;
    }

    const expected = new URL(request.url);

    // Allow equivalent local addresses during local testing.
    return (
      localHosts.includes(parsed.hostname) &&
      localHosts.includes(expected.hostname) &&
      parsed.protocol === expected.protocol &&
      parsed.port === expected.port
    );
  } catch {
    return false;
  }
}

// Return only verified account status information.
export function validateAccountMutation(data, userId, body) {
  const account = data?.account;

  if (
    data?.success !== true ||
    !validObject(account) ||
    !validId(account.userId) ||
    account.userId !== userId ||
    !["student", "tutor"].includes(account.role) ||
    account.accountStatus !== body.status ||
    account.previousStatus !== body.expectedStatus
  ) {
    throw new Error("Invalid account status response.");
  }

  return {
    success: true,
    account: {
      userId: account.userId,
      role: account.role,
      previousStatus: account.previousStatus,
      accountStatus: account.accountStatus,
    },
  };
}

// Return only verified tutor approval information.
export function validateApprovalMutation(data, profileId, body) {
  const approval = data?.approval;

  if (
    data?.success !== true ||
    !validObject(approval) ||
    !validId(approval.profileId) ||
    !validId(approval.userId) ||
    approval.profileId !== profileId ||
    approval.approvalStatus !== body.status ||
    approval.previousStatus !== body.expectedStatus
  ) {
    throw new Error("Invalid tutor approval response.");
  }

  return {
    success: true,
    approval: {
      profileId: approval.profileId,
      userId: approval.userId,
      previousStatus: approval.previousStatus,
      approvalStatus: approval.approvalStatus,
    },
  };
}
