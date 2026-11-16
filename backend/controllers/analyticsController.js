const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const AnalyticsEvent = require("../models/AnalyticsEvent");

const VALID_PLATFORMS = ["web", "ios", "android"];

// POST /api/analytics/event  (public, fire-and-forget)
// Body: { type, visitorId, path?, tournamentId?, platform? }
// Records a usage/view event. Never errors the client — analytics must never
// break the app, so every failure still returns success.
exports.recordEvent = async (req, res) => {
  try {
    const type = (req.body?.type || "page_view").toString().slice(0, 40);
    const visitorId = (req.body?.visitorId || "").toString().slice(0, 64);
    const path = (req.body?.path || "").toString().slice(0, 200);
    const platform = VALID_PLATFORMS.includes(req.body?.platform) ? req.body.platform : "web";

    let tournament = null;
    if (req.body?.tournamentId && mongoose.isValidObjectId(req.body.tournamentId)) {
      tournament = req.body.tournamentId;
    }

    // Soft-auth: if a valid token rode along, attribute the event to that user
    // (so signed-in viewers are counted). Anonymous viewers rely on visitorId.
    let user = null;
    const auth = req.headers.authorization;
    if (auth && auth.startsWith("Bearer ")) {
      try {
        const decoded = jwt.verify(auth.split(" ")[1], process.env.JWT_SECRET);
        if (decoded?.id) user = decoded.id;
      } catch (_) { /* ignore bad/expired tokens — still record anonymously */ }
    }

    // Nothing to attribute → skip (don't store junk rows).
    if (!visitorId && !user) return res.json({ success: true });

    await AnalyticsEvent.create({ type, visitorId, path, platform, tournament, user });
    return res.json({ success: true });
  } catch (error) {
    // Swallow — analytics is best-effort.
    return res.json({ success: true });
  }
};
