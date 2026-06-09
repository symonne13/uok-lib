const express = require("express");
const router = express.Router();

const { getUserProfile } = require("../controllers/user.controller");

router.get("/profile", getUserProfile);

module.exports = router;
