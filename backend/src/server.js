
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./config/db");

const app = express();

// Middleware
app.use(cors({
  origin: "http://localhost:3000"
}));

app.use(express.json());

// Home API route
app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "TuLinkUp Backend API is running!"
  });
});

// Test Supabase PostgreSQL connection
app.get("/api/db-test", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT NOW() AS current_time"
    );

    res.json({
      success: true,
      message: "TuLinkUp connected to Supabase!",
      database_time: result.rows[0].current_time
    });

  } catch (error) {
    console.error("Database connection error:", error.message);

    res.status(500).json({
      success: false,
      message: "Database connection failed"
    });
  }
});

// Server configuration
const PORT = process.env.PORT || 5001;

// Start Express server
const server = app.listen(PORT, () => {
  console.log(`TuLinkUp API listening on port ${PORT}`);
});

// Handle server errors
server.on("error", (error) => {
  console.error("Server error:", error.message);
});

// Handle server shutdown
server.on("close", () => {
  console.log("TuLinkUp server was closed");
});
