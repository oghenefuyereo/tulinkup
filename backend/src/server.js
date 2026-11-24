
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./config/db");

const { handleStripeWebhook } = require("./controllers/stripeWebhookController");

// Routes for the main features of TuLinkUp.
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

// Routes for group classes, live sessions, and payments.
const groupClassRoutes = require("./routes/groupClassRoutes");
const liveSessionRoutes = require("./routes/liveSessionRoutes");
const stripeConnectRoutes = require("./routes/stripeConnectRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();
const PORT = process.env.PORT || 5001;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Allow requests from the TuLinkUp frontend.
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

// Stripe needs the original request body to verify webhook events.
// This must come before express.json().
app.post(
  "/api/payments/webhook",
  express.raw({
    type: "application/json",
    limit: "256kb",
  }),
  handleStripeWebhook
);

// Allow Express to read JSON sent from the frontend.
app.use(express.json({ limit: "1mb" }));

// Check that the backend is running.
app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "TuLinkUp Backend API is running!",
  });
});

// Another simple way to check if the server is working.
app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    service: "TuLinkUp Backend API",
    timestamp: new Date().toISOString(),
  });
});

// Health check using the API path.
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    service: "TuLinkUp Backend API",
    timestamp: new Date().toISOString(),
  });
});

// Check if the backend can connect to Supabase.
app.get("/api/db-test", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT NOW() AS current_time"
    );

    res.json({
      success: true,
      message: "TuLinkUp connected to Supabase!",
      database_time: result.rows[0].current_time,
    });
  } catch (error) {
    console.error("Database connection error:", error.message);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

// Connect the routes to their API paths.
app.use("/api/auth", authRoutes);

// Register protected administrator endpoints.
app.use("/api/admin", require("./routes/adminRoutes"));
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

// Group classes and live tutoring sessions.
app.use("/api/group-classes", groupClassRoutes);
app.use("/api/live-sessions", liveSessionRoutes);

// Stripe Connect and payment routes.
app.use("/api/stripe-connect", stripeConnectRoutes);
app.use("/api/payments", paymentRoutes);

// Return a 404 response if the requested route does not exist.
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

// Handle errors so the server does not return unnecessary details to users.
app.use((error, req, res, next) => {
  console.error("API error:", error);

  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      success: false,
      message: "Uploaded file is too large.",
    });
  }

  if (error.name === "MulterError") {
    return res.status(400).json({
      success: false,
      message: "Invalid file upload.",
    });
  }

  // Let the user know if the JSON they sent is invalid.
  if (
    error instanceof SyntaxError &&
    error.status === 400 &&
    "body" in error
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON request body.",
    });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "Request body is too large.",
    });
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// Start the TuLinkUp backend.
const server = app.listen(PORT, () => {
  console.log(`TuLinkUp API listening on port ${PORT}`);
  console.log(`Frontend: ${FRONTEND_URL}`);
});

// Show any errors that happen when starting the server.
server.on("error", (error) => {
  console.error("Server error:", error.message);
});

server.on("close", () => {
  console.log("TuLinkUp server was closed");
});
