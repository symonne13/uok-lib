const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");

router.post("/register", authController.register); // ← what frontend calls
router.post("/signup", authController.register);   // ← keep old one too
router.post("/login", authController.login);

module.exports = router;