const mongoose = require("mongoose");

// A record of every consequential admin action (approvals, disables, deletes),
// so the admin panel has an accountability trail.
const AuditLogSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    adminEmail: { type: String, default: "" },
    action: { type: String, required: true }, // e.g. 'tournament.approve', 'user.disable'
    targetType: { type: String, default: "" }, // 'tournament' | 'user' | 'match'
    targetId: { type: String, default: "" },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

AuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AuditLog", AuditLogSchema);
