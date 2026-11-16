const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const analytics = require("../controllers/analyticsController");

// Generous cap so normal viewers never hit it, but a single IP can't flood the
// collection: 300 events / 5 minutes.
const eventLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: true }, // stay quiet — analytics is best-effort
});

router.post("/event", eventLimiter, analytics.recordEvent);

module.exports = router;
