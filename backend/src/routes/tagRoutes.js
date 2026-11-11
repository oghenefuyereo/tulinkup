
const express = require("express");

const {
  getTags,
  getTagById,
} = require("../controllers/tagController");

const router = express.Router();

router.get("/", getTags);
router.get("/:id", getTagById);

module.exports = router;
