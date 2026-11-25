"use strict";

// Convert database counts without accepting invalid values.
function parseDatabaseCount(value) {
  if (
    typeof value !== "number" &&
    typeof value !== "string"
  ) {
    throw new Error("Invalid database count.");
  }

  if (
    typeof value === "string" &&
    !/^(0|[1-9][0-9]*)$/.test(value)
  ) {
    throw new Error("Invalid database count.");
  }

  const number = Number(value);

  if (
    !Number.isSafeInteger(number) ||
    number < 0
  ) {
    throw new Error("Invalid database count.");
  }

  return number;
}

module.exports = {
  parseDatabaseCount,
};
