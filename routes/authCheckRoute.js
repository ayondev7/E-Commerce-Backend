const express = require("express");
const router = express.Router();
const authCheck = require("../controllers/authCheckController");

router.get("/auth-check", authCheck.getUserType);

module.exports = router;
