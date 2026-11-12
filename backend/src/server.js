
// Load environment variables so the app can use settings from the .env file.
require("dotenv").config();

// Import the packages needed to run the backend.
const express = require("express");
const cors = require("cors");

// Import the database connection.
const pool = require("./config/db");

// Import the routes that handle different parts of TuLinkUp.
const authRoutes = require("./routes/authRoutes");
const tutorRoutes = require("./routes/tutorRoutes");
const profileRoutes = require("./routes/profileRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const availabilityRoutes = require("./routes/availabilityRoutes");
const mediaRoutes = require("./routes/mediaRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const subjectRoutes = require("./routes/subjectRoutes");
const tagRoutes = require("./routes/tagRoutes");
const tutorProfileRoutes = require("./routes/tutorProfileRoutes");
const userRoutes = require("./routes/userRoutes");

// Create the Express app and set the port it will run on.
const app = express();
const PORT = process.env.PORT || 5001;

// Allow the frontend to communicate with the backend.
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Allow the server to read JSON data sent in requests.
app.use(express.json());

// A simple endpoint to check if the backend is running.
app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "TuLinkUp Backend API is running!",
  });
});

// Test the database connection by requesting the current database time.
app.get("/api/db-test", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT NOW() AS current_time"
    );

    // Send a success response if the database is connected.
    res.json({
      success: true,
      message: "TuLinkUp connected to Supabase!",
      database_time: result.rows[0].current_time,
    });
  } catch (error) {
    // Log the error and let the client know the connection failed.
    console.error("Database connection error:", error.message);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

// Connect each route to its corresponding API endpoint.
app.use("/api/auth", authRoutes);
app.use("/api/tutors", tutorRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/tags", tagRoutes);
app.use("/api/tutor-profiles", tutorProfileRoutes);
app.use("/api/users", userRoutes);

// Return a 404 response when someone requests an endpoint that does not exist.
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

// Handle errors in one place so the server can return useful responses.
app.use((error, req, res, next) => {
  console.error("API error:", error);

  // Handle files that are larger than the allowed upload size.
  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      success: false,
      message: "Uploaded file is too large.",
    });
  }

  // Handle other file upload errors.
  if (error.name === "MulterError") {
    return res.status(400).json({
      success: false,
      message: "Invalid file upload.",
    });
  }

  // Return a general error message if something unexpected happens.
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// Start the backend server and display the port in the terminal.
const server = app.listen(PORT, () => {
  console.log(`TuLinkUp API listening on port ${PORT}`);
});

// Log any errors that happen while the server is running.
server.on("error", (error) => {
  console.error("Server error:", error.message);
});

// Display a message when the server closes.
server.on("close", () => {
  console.log("TuLinkUp server was closed");
});
