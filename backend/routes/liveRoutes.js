const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const liveController = require("../controllers/liveController");

// Logged-in users only — we don't expose a fully-anonymous live feed yet.
router.get("/matches", protect, liveController.getLiveMatches);
// Curated feed of owner-featured tournaments (upcoming + live) for the dashboard.
router.get("/tournaments", protect, liveController.getFeaturedTournaments);

module.exports = router;
