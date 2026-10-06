const express = require("express");
const router = express.Router();
const { protect, requireAdmin } = require("../middleware/authMiddleware");
const admin = require("../controllers/adminController");

// Every admin route requires a signed-in ADMIN account.
router.use(protect, requireAdmin);

// Identity / access check
router.get("/me", admin.me);

// Overview
router.get("/overview", admin.overview);

// Tournament approvals + management
router.get("/tournaments", admin.listTournaments);
router.post("/tournaments/:id/approve", admin.setTournamentApproval);
router.post("/tournaments/:id/reject", admin.rejectTournament);
router.delete("/tournaments/:id", admin.deleteTournament);

// User management
router.get("/users", admin.listUsers);
router.get("/users/:id", admin.getUser);
router.post("/users/:id/status", admin.setUserStatus);
router.post("/users/:id/role", admin.setUserRole);

// Content cleanup
router.get("/content/issues", admin.contentIssues);
router.delete("/content/orphan-matches", admin.deleteOrphanMatches);

// Audit log
router.get("/audit", admin.auditLog);

module.exports = router;
