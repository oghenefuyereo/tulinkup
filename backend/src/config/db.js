
 // Load environment variables from the .env file.
require("dotenv").config();

// Import the PostgreSQL Pool class to manage database connections.
const { Pool } = require("pg");

// Create a connection pool for the Supabase PostgreSQL database.
const pool = new Pool({
  // Get the database connection URL from the environment variables.
  connectionString: process.env.DATABASE_URL,

  // Enable SSL for a secure connection to the database.
  ssl: {
    rejectUnauthorized: false
  }
});

// Export the connection pool so other files can use it.
module.exports = pool;
