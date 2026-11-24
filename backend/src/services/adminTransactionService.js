"use strict";

const pool = require("../config/db");

// Track active administrator transactions and their verified actors.
const activeTransactions = new WeakMap();

// Create an error that administrator controllers can handle.
function adminTransactionError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// Validate a positive PostgreSQL database ID.
function validateAdminId(value) {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    throw adminTransactionError(
      "Invalid administrator ID.",
      400
    );
  }

  if (
    typeof value === "number" &&
    (!Number.isSafeInteger(value) || value <= 0)
  ) {
    throw adminTransactionError(
      "Invalid administrator ID.",
      400
    );
  }

  const id = String(value);

  if (
    !/^[1-9]\d{0,18}$/.test(id) ||
    BigInt(id) > 9223372036854775807n
  ) {
    throw adminTransactionError(
      "Invalid administrator ID.",
      400
    );
  }

  return id;
}

// Make sure the client belongs to an active administrator transaction.
function validateAdminTransactionClient(client, adminId) {
  const id = validateAdminId(adminId);

  if (
    !client ||
    typeof client.query !== "function" ||
    activeTransactions.get(client) !== id
  ) {
    throw adminTransactionError(
      "An active administrator transaction is required."
    );
  }

  return id;
}

// Verify the administrator and prevent account changes during the operation.
async function lockActiveAdministrator(client, adminId) {
  const result = await client.query(
    `SELECT id, role, account_status
     FROM public.users
     WHERE id = $1::bigint
       AND role = 'admin'
       AND account_status = 'active'
     FOR SHARE`,
    [adminId]
  );

  if (result.rows.length !== 1) {
    throw adminTransactionError(
      "Active administrator access required.",
      403
    );
  }

  const administrator = result.rows[0];

  if (
    String(administrator.id) !== adminId ||
    administrator.role !== "admin" ||
    administrator.account_status !== "active"
  ) {
    throw adminTransactionError(
      "Administrator verification failed.",
      403
    );
  }
}

// Run administrator operations using a single database transaction.
async function withAdminTransaction(
  adminId,
  callback,
  database = pool
) {
  const id = validateAdminId(adminId);

  if (typeof callback !== "function") {
    throw adminTransactionError(
      "Invalid administrator transaction callback."
    );
  }

  if (
    !database ||
    typeof database.connect !== "function"
  ) {
    throw adminTransactionError(
      "Invalid database connection provider."
    );
  }

  const client = await database.connect();

  let transactionStarted = false;
  let commitStarted = false;
  let releaseError;

  try {
    // Start the transaction before verifying the administrator.
    await client.query("BEGIN");
    transactionStarted = true;

    // Prevent SQL statements and locks from waiting indefinitely.
    await client.query(
      "SET LOCAL lock_timeout = '5s'"
    );

    await client.query(
      "SET LOCAL statement_timeout = '15s'"
    );

    await client.query(
      "SET LOCAL idle_in_transaction_session_timeout = '30s'"
    );

    await lockActiveAdministrator(client, id);

    // Associate the transaction with the verified administrator.
    activeTransactions.set(client, id);

    const result = await callback(client, id);

    // Stop accepting operations before committing.
    activeTransactions.delete(client);

    commitStarted = true;

    const commitResult = await client.query("COMMIT");

    if (
      !commitResult ||
      commitResult.command !== "COMMIT"
    ) {
      throw adminTransactionError(
        "Administrator transaction was not committed."
      );
    }

    transactionStarted = false;
    commitStarted = false;

    return result;

  } catch (error) {
    activeTransactions.delete(client);

    // A failed commit may leave the final database outcome uncertain.
    if (commitStarted) {
      releaseError = new Error(
        "Administrator commit outcome is uncertain."
      );

      const commitError = adminTransactionError(
        "Administrator transaction outcome requires verification.",
        503
      );

      commitError.code = "ADMIN_COMMIT_UNCERTAIN";

      throw commitError;
    }

    if (transactionStarted) {
      try {
        const rollbackResult = await client.query("ROLLBACK");

        if (
          !rollbackResult ||
          rollbackResult.command !== "ROLLBACK"
        ) {
          throw new Error(
            "Administrator rollback could not be verified."
          );
        }

        transactionStarted = false;

      } catch {
        // Discard connections that cannot be safely rolled back.
        releaseError = new Error(
          "Administrator transaction rollback failed."
        );
      }
    } else {
      // Discard the connection if transaction startup failed.
      releaseError = new Error(
        "Administrator transaction startup failed."
      );
    }

    throw error;

  } finally {
    activeTransactions.delete(client);
    client.release(releaseError);
  }
}

module.exports = {
  validateAdminId,
  validateAdminTransactionClient,
  withAdminTransaction,
};
