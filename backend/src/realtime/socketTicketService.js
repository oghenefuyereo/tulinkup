"use strict";

const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");

const TICKET_ISSUER = "tulinkup-api";
const TICKET_AUDIENCE = "tulinkup-realtime";
const TICKET_LIFETIME_SECONDS = 60;

// Derive a separate signing key for real-time tickets.
function getTicketSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("Socket ticket configuration unavailable.");
  }

  return crypto
    .createHmac("sha256", secret)
    .update("tulinkup-realtime-ticket-v1")
    .digest();
}

// Validate the authenticated user's identity.
function validateIdentity(userId, role) {
  const id = String(userId);

  if (
    !/^[1-9][0-9]{0,18}$/.test(id) ||
    BigInt(id) > 9223372036854775807n ||
    !["student", "tutor"].includes(role)
  ) {
    throw new Error("Invalid messaging identity.");
  }

  return { userId: id, role };
}

// Create a short-lived ticket for an authenticated user.
function createSocketTicket(user) {
  const identity = validateIdentity(
    user.userId,
    user.role
  );

  const ticket = jwt.sign(
    {
      ...identity,
      purpose: "realtime"
    },
    getTicketSecret(),
    {
      algorithm: "HS256",
      issuer: TICKET_ISSUER,
      audience: TICKET_AUDIENCE,
      expiresIn: TICKET_LIFETIME_SECONDS,
      jwtid: crypto.randomUUID()
    }
  );

  return {
    ticket,
    expiresIn: TICKET_LIFETIME_SECONDS
  };
}

// Verify a real-time authentication ticket.
function verifySocketTicket(ticket) {
  if (
    typeof ticket !== "string" ||
    !ticket ||
    ticket.length > 4096
  ) {
    throw new Error("Invalid socket ticket.");
  }

  const decoded = jwt.verify(
    ticket,
    getTicketSecret(),
    {
      algorithms: ["HS256"],
      issuer: TICKET_ISSUER,
      audience: TICKET_AUDIENCE,
      maxAge: "60s"
    }
  );

  if (
    !decoded ||
    decoded.purpose !== "realtime" ||
    typeof decoded.jti !== "string" ||
    !Number.isInteger(decoded.exp)
  ) {
    throw new Error("Invalid socket ticket.");
  }

  return {
    ...validateIdentity(
      decoded.userId,
      decoded.role
    ),
    ticketId: decoded.jti,
    expiresAt: decoded.exp
  };
}

module.exports = {
  createSocketTicket,
  verifySocketTicket
};
