"use strict";

const {
  registerTypingEvents
} = require("./typingEvents");


const { Server } = require("socket.io");
const pool = require("../config/db");
const {
  verifySocketTicket
} = require("./socketTicketService");

let io = null;

// Track consumed tickets until they expire.
const consumedTickets = new Map();
const MAX_CONSUMED_TICKETS = 50000;

// Real-time connection security limits.
const ACCOUNT_RECHECK_INTERVAL_MS = 60 * 1000;
const MAX_CONNECTION_LIFETIME_MS = 15 * 60 * 1000;
const MAX_CONNECTIONS_PER_USER = 5;

const activeConnections = new Map();

function consumeSocketTicket(identity) {
  const now = Math.floor(Date.now() / 1000);

  for (const [ticketId, expiresAt] of consumedTickets) {
    if (expiresAt <= now) {
      consumedTickets.delete(ticketId);
    }
  }

  if (
    identity.expiresAt <= now ||
    consumedTickets.has(identity.ticketId) ||
    consumedTickets.size >= MAX_CONSUMED_TICKETS
  ) {
    throw new Error("Socket ticket unavailable.");
  }

  consumedTickets.set(
    identity.ticketId,
    identity.expiresAt
  );
}

// Initialize Socket.IO using the existing HTTP server.
function initializeSocketServer(httpServer, frontendUrl) {
  if (io) {
    throw new Error("Socket.IO server already initialized.");
  }

  const allowedOrigin = new URL(frontendUrl).origin;

  io = new Server(httpServer, {
    path: "/socket.io",

    cors: {
      origin: allowedOrigin,
      methods: ["GET", "POST"],
      credentials: false
    },

    // Restrict browser connections to the approved frontend.
    allowRequest: (request, callback) => {
      const origin = request.headers.origin;

      callback(null, origin === allowedOrigin);
    },

    transports: ["websocket", "polling"],

    // Limit incoming socket payloads to 64 KB.
    maxHttpBufferSize: 64 * 1024,

    pingInterval: 25000,
    pingTimeout: 20000,
    connectTimeout: 10000,

    serveClient: false
  });

  // Authenticate every incoming socket connection.
  io.use(async (socket, next) => {
    try {
      const identity = verifySocketTicket(
        socket.handshake.auth?.ticket
      );

      const result = await pool.query(
        `SELECT id, role, account_status
         FROM public.users
         WHERE id = $1`,
        [identity.userId]
      );

      const user = result.rows[0];

      if (
        !user ||
        user.account_status !== "active" ||
        user.role !== identity.role ||
        !["student", "tutor"].includes(user.role) ||
        identity.expiresAt <= Math.floor(Date.now() / 1000)
      ) {
        throw new Error("Invalid account permissions.");
      }

      // Prevent the same ticket from being used twice.
      consumeSocketTicket(identity);

      socket.data.user = {
        userId: String(user.id),
        role: user.role
      };

      return next();
    } catch {
      const error = new Error(
        "Real-time authentication failed."
      );

      error.data = {
        code: "AUTH_REQUIRED"
      };

      return next(error);
    }
  });

  // Assign authenticated users to server-controlled rooms.
  io.on("connection", async (socket) => {
    const { userId, role } = socket.data.user;

    let connections = activeConnections.get(userId);

    if (!connections) {
      connections = new Set();
      activeConnections.set(userId, connections);
    }

    // Prevent excessive connections from a single account.
    if (connections.size >= MAX_CONNECTIONS_PER_USER) {
      socket.disconnect(true);
      return;
    }

    connections.add(socket.id);

    let accountTimer = null;
    let lifetimeTimer = null;
    let checkingAccount = false;

    // Release connection resources on disconnect.
    socket.once("disconnect", () => {
      clearInterval(accountTimer);
      clearTimeout(lifetimeTimer);

      connections.delete(socket.id);

      if (connections.size === 0) {
        activeConnections.delete(userId);
      }
    });

    // Periodically verify that the account remains authorized.
    async function revalidateAccount() {
      if (!socket.connected || checkingAccount) {
        return;
      }

      checkingAccount = true;

      try {
        const result = await pool.query(
          `SELECT id, role, account_status
           FROM public.users
           WHERE id = $1`,
          [userId]
        );

        const user = result.rows[0];

        if (
          !user ||
          user.account_status !== "active" ||
          user.role !== role
        ) {
          socket.disconnect(true);
        }
      } catch {
        // Fail closed when authorization cannot be verified.
        socket.disconnect(true);
      } finally {
        checkingAccount = false;
      }
    }

    try {
      await socket.join(`user:${userId}`);

      if (!socket.connected) {
        return;
      }

      accountTimer = setInterval(
        revalidateAccount,
        ACCOUNT_RECHECK_INTERVAL_MS
      );

      // Require a new authentication ticket periodically.
      lifetimeTimer = setTimeout(() => {
        socket.disconnect(true);
      }, MAX_CONNECTION_LIFETIME_MS);

      // Register authorized typing events.
      registerTypingEvents(io, socket);

      socket.emit("realtime:ready", {
        connected: true
      });
    } catch {
      socket.disconnect(true);
    }
  });

  console.log("TuLinkUp real-time server initialized.");

  return io;
}

// Retrieve the initialized Socket.IO instance.
function getSocketServer() {
  if (!io) {
    throw new Error("Socket.IO server is not initialized.");
  }

  return io;
}

module.exports = {
  initializeSocketServer,
  getSocketServer
};
