const express = require("express");
const router = express.Router();
const { getAppVersion } = require("../controllers/appController");

// Public — the mobile app polls this on launch to decide whether to show the
// "Update available" prompt. No auth so it works before login too.
router.get("/version", getAppVersion);

module.exports = router;
