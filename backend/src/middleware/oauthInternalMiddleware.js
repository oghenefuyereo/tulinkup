
"use strict";

const { timingSafeEqual } = require("node:crypto");

function requireOAuthInternal(req, res, next) {
  res.set("Cache-Control", "no-store");

  const expected = process.env.OAUTH_INTERNAL_SECRET;
  const received = req.get("x-oauth-internal-secret");

  if (!expected || !received) {
    return res.status(403).json({
      success: false,
      message: "Unauthorized OAuth request."
    });
  }

  const a = Buffer.from(received);
  const b = Buffer.from(expected);

  if (
    a.length !== b.length ||
    !timingSafeEqual(a, b)
  ) {
    return res.status(403).json({
      success: false,
      message: "Unauthorized OAuth request."
    });
  }

  next();
}

module.exports = { requireOAuthInternal };
