
const express = require("express");

const { protect } = require("../middleware/authMiddleware");

const {
  getMyAccount,
  updateMyAccount,
} = require("../controllers/userController");

const router = express.Router();

router.get("/me", protect, getMyAccount);

router.put("/me", protect, updateMyAccount);

module.exports = router;
