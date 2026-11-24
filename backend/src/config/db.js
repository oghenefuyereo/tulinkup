"use strict";

require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Database connection URL is missing.");
}

if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
  throw new Error("Global TLS verification must remain enabled.");
}

const databaseUrl = new URL(connectionString);

if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
  throw new Error("Invalid database connection protocol.");
}

// Prevent connection URL options from overriding security settings.
if ([...databaseUrl.searchParams.keys()].length > 0) {
  throw new Error("Unexpected database connection URL options.");
}

const isLocalDatabase = [
  "localhost",
  "127.0.0.1",
  "[::1]"
].includes(databaseUrl.hostname);

const allowLocalTestConnection =
  isLocalDatabase &&
  process.env.NODE_ENV === "test" &&
  process.env.ALLOW_LOCAL_DATABASE_WITHOUT_TLS === "true";

let ssl;

if (allowLocalTestConnection) {
  // Allow unencrypted connections only for isolated local tests.
  ssl = false;
} else {
  // Verify the database server using the official Supabase certificate.
  const certificatePath = path.join(
    __dirname,
    "certificates",
    "prod-ca-2021.crt"
  );

  ssl = {
    ca: fs.readFileSync(certificatePath, "utf8"),
    rejectUnauthorized: true,
    minVersion: "TLSv1.2"
  };
}

// Share the connection pool across the backend.
const pool = new Pool({
  connectionString,
  ssl
});

module.exports = pool;
