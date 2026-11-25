"use strict";

const pool = require("../config/db");
const {
  validateTutorId,
} = require("./tutorEligibilityService");

const transactions = new WeakMap();

// Create an error that booking controllers can handle.
function bookingError(message, statusCode = 500, code) {
  const error = new Error(message);
  error.statusCode = statusCode;

  if (code) {
    error.code = code;
  }

  return error;
}

// Watch for connection failures while a booking owns the client.
function watchBookingConnection(client, transaction) {
  const handleError = () => {
    transaction.releaseError = new Error(
      "Booking database connection failed."
    );
  };

  client.on("error", handleError);

  transaction.handleConnectionError = handleError;
}

// Return the connection to the pool and remove our listener.
function releaseBookingConnection(client, transaction, error) {
  try {
    client.release(error || transaction.releaseError);
  } finally {
    client.removeListener(
      "error",
      transaction.handleConnectionError
    );
  }
}

// Start a booking transaction with bounded database timeouts.
async function beginBookingTransaction(database = pool) {
  const client = await database.connect();

  const transaction = {
    state: "starting",
    releaseError: undefined,
  };

  watchBookingConnection(client, transaction);

  try {
    const result = await client.query("BEGIN");

    if (result.command !== "BEGIN") {
      throw bookingError(
        "Booking transaction could not be started."
      );
    }

    await client.query(
      "SET LOCAL lock_timeout = '5s'"
    );

    await client.query(
      "SET LOCAL statement_timeout = '15s'"
    );

    await client.query(
      "SET LOCAL idle_in_transaction_session_timeout = '30s'"
    );

    if (transaction.releaseError) {
      throw transaction.releaseError;
    }

    transaction.state = "active";

    transactions.set(client, transaction);

    return client;

  } catch (error) {
    releaseBookingConnection(
      client,
      transaction,
      new Error("Booking transaction startup failed.")
    );

    throw error;
  }
}

// Make sure the connection belongs to an active booking transaction.
function requireActiveTransaction(client) {
  const transaction = transactions.get(client);

  if (!transaction || transaction.state !== "active") {
    throw bookingError(
      "An active booking transaction is required."
    );
  }

  return transaction;
}

// Verify the user's account inside the transaction.
async function lockActiveBookingUser(client, userId, role) {
  requireActiveTransaction(client);

  const id = validateTutorId(userId);

  if (!["student", "tutor"].includes(role)) {
    throw bookingError("Access denied.", 403);
  }

  const result = await client.query(
    `SELECT id, role, account_status
     FROM public.users
     WHERE id = $1::bigint
       AND role = $2
       AND account_status = 'active'
     FOR SHARE`,
    [id, role]
  );

  const user = result.rows[0];

  if (
    result.rows.length !== 1 ||
    String(user.id) !== id ||
    user.role !== role ||
    user.account_status !== "active"
  ) {
    throw bookingError(
      "An active account is required.",
      403
    );
  }

  return id;
}

// Commit the transaction and verify the database response.
async function commitBookingTransaction(client) {
  const transaction = requireActiveTransaction(client);

  transaction.state = "committing";

  try {
    if (transaction.releaseError) {
      throw transaction.releaseError;
    }

    const result = await client.query("COMMIT");

    if (
      transaction.releaseError ||
      !result ||
      result.command !== "COMMIT"
    ) {
      throw new Error(
        "Booking commit could not be verified."
      );
    }

    transaction.state = "committed";

  } catch {
    transaction.state = "uncertain";

    transaction.releaseError = new Error(
      "Booking commit outcome is uncertain."
    );

    throw bookingError(
      "The booking outcome requires verification. Refresh before trying again.",
      503,
      "BOOKING_COMMIT_UNCERTAIN"
    );
  }
}

// Roll back unfinished changes and discard unsafe connections.
async function rollbackBookingTransaction(client) {
  const transaction = transactions.get(client);

  if (!transaction) {
    throw bookingError(
      "Unknown booking transaction."
    );
  }

  if (transaction.state === "rolled_back") {
    return;
  }

  if (transaction.state !== "active") {
    throw bookingError(
      "Booking transaction cannot be rolled back."
    );
  }

  transaction.state = "rolling_back";

  try {
    if (transaction.releaseError) {
      throw transaction.releaseError;
    }

    const result = await client.query("ROLLBACK");

    if (
      transaction.releaseError ||
      !result ||
      result.command !== "ROLLBACK"
    ) {
      throw new Error(
        "Booking rollback could not be verified."
      );
    }

    transaction.state = "rolled_back";

  } catch {
    transaction.state = "failed";

    transaction.releaseError = new Error(
      "Booking transaction rollback failed."
    );

    throw bookingError(
      "Booking transaction could not be safely completed.",
      503,
      "BOOKING_ROLLBACK_FAILED"
    );
  }
}

// Release the connection only when its transaction state is safe.
function releaseBookingTransaction(client) {
  const transaction = transactions.get(client);

  if (!transaction) {
    throw bookingError(
      "Unknown or released booking transaction."
    );
  }

  transactions.delete(client);

  const safe = [
    "committed",
    "rolled_back",
  ].includes(transaction.state);

  releaseBookingConnection(
    client,
    transaction,
    transaction.releaseError ||
      (safe
        ? undefined
        : new Error("Unfinished booking transaction."))
  );
}

// Handle unfinished transactions without retrying an uncertain commit.
async function abortBookingTransaction(client) {
  const transaction = transactions.get(client);

  if (!transaction) {
    throw bookingError(
      "Unknown booking transaction."
    );
  }

  if (transaction.state === "active") {
    await rollbackBookingTransaction(client);
  }
}

module.exports = {
  beginBookingTransaction,
  lockActiveBookingUser,
  commitBookingTransaction,
  rollbackBookingTransaction,
  abortBookingTransaction,
  releaseBookingTransaction,
};
