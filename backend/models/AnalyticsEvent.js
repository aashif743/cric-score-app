const mongoose = require("mongoose");

// A lightweight usage event — mostly page/screen views and app opens, from both
// anonymous visitors (identified by a client-generated `visitorId`) and signed-in
// users (`user` set via a soft token parse). Powers viewer/traffic analytics for
// the public live pages, overlay and TV boards that have no per-user login.
//
// Raw events auto-expire after 120 days (TTL index) so the collection stays small;
// the admin dashboard aggregates rolling windows on demand.
const analyticsEventSchema = new mongoose.Schema(
  {
    // e.g. 'app_open', 'live_view', 'overlay_view', 'scorecard_view', 'page_view'
    type: { type: String, required: true },
    // Anonymous client id (localStorage / AsyncStorage). Empty for pure server events.
    visitorId: { type: String, default: "" },
    // Signed-in user, when a valid token accompanied the ping.
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // Route/screen label, e.g. '/overlay/tournament/:id' or 'DashboardScreen'.
    path: { type: String, default: "" },
    tournament: { type: mongoose.Schema.Types.ObjectId, ref: "Tournament", default: null },
    // 'web' | 'ios' | 'android'
    platform: { type: String, default: "web" },
  },
  { timestamps: true }
);

// Auto-expire raw events after 120 days.
analyticsEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 120 * 24 * 60 * 60 });
// Fast rolling-window counts and unique-visitor lookups.
analyticsEventSchema.index({ type: 1, createdAt: -1 });
analyticsEventSchema.index({ visitorId: 1, createdAt: -1 });

module.exports = mongoose.model("AnalyticsEvent", analyticsEventSchema);
