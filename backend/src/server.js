
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const pool = require("./config/db");

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

const app = express();
const PORT = process.env.PORT || 5001;

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());

app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "TuLinkUp Backend API is running!",
  });
});

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

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

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

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

const server = app.listen(PORT, () => {
  console.log(`TuLinkUp API listening on port ${PORT}`);
});

server.on("error", (error) => {
  console.error("Server error:", error.message);
});

server.on("close", () => {
  console.log("TuLinkUp server was closed");
});
