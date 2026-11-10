
const express = require("express");

const {
  register,
  login
} = require("../controllers/authController");

const router = express.Router();

// Register new student or tutor
router.post("/register", register);

// Login existing student or tutor
router.post("/login", login);

module.exports = router;
