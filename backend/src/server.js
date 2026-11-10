
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors({
  origin: "http://localhost:3000"
}));

app.use(express.json());

app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "TuLinkUp Backend API is running!"
  });
});

const PORT = 5001;

const server = app.listen(PORT, () => {
  console.log(`TuLinkUp API listening on port ${PORT}`);
});

server.on("error", (error) => {
  console.error("Server error:", error);
});

server.on("close", () => {
  console.log("TuLinkUp server was closed");
});
