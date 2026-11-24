"use strict";

const jwt = require("jsonwebtoken");
const pool = require("../config/db");

// Authenticate users and verify their current database permissions.
async function protect(req, res, next) {
  res.set("Cache-Control", "no-store");

  const authorization = req.headers.authorization;

  if (
    typeof authorization !== "string" ||
    !authorization.startsWith("Bearer ")
  ) {
    return res.status(401).json({
      success: false,
      message: "Authentication required."
    });
  }

  const token = authorization.slice(7);

  if (!token || !process.env.JWT_SECRET) {
    return res.status(401).json({
      success: false,
      message: "Invalid authentication."
    });
  }

  let decoded;

  try {
    decoded = jwt.verify(
      token,
      process.env.JWT_SECRET,
      { algorithms: ["HS256"] }
    );

    if (
      !decoded ||
      typeof decoded !== "object" ||
      !["string", "number"].includes(typeof decoded.userId) ||
      !/^[1-9][0-9]{0,18}$/.test(String(decoded.userId)) ||
      BigInt(decoded.userId) > 9223372036854775807n ||
      (
        typeof decoded.userId === "number" &&
        !Number.isSafeInteger(decoded.userId)
      ) ||
      !["student", "tutor", "admin"].includes(decoded.role)
    ) {
      throw new Error("Invalid token identity.");
    }
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token."
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, role, account_status
       FROM public.users
       WHERE id = $1`,
      [String(decoded.userId)]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Account not found."
      });
    }

    if (user.account_status !== "active") {
      return res.status(403).json({
        success: false,
        message: "This account is not active."
      });
    }

    if (
      !["student", "tutor", "admin"].includes(user.role) ||
      decoded.role !== user.role
    ) {
      return res.status(403).json({
        success: false,
        message: "Account permissions changed. Please sign in again."
      });
    }

    req.user = {
      userId: user.id,
      role: user.role
    };
  } catch {
    console.error("Authentication database verification failed.");

    return res.status(503).json({
      success: false,
      message: "Authentication temporarily unavailable."
    });
  }

  return next();
}

module.exports = { protect };
