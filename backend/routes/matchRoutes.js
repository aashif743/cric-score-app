const express = require("express");
const router = express.Router();
const matchController = require("../controllers/matchController"); 

const { validateEndMatch } = require("../utils/matchValidation");
const { protect } = require('../middleware/authMiddleware');

// --- Main Match Routes ---
router.route("/")
    .post(protect, matchController.createMatch)          // Create new match
    .get(protect, matchController.getMyMatches);         // Get all matches for user

router.delete("/all", protect, matchController.deleteAllMatches);

// --- Specific Match Routes ---
router.route("/:id")
    .get(protect, matchController.getMatchById)          // Get match details
    .put(protect, matchController.updateMatch)           // Update match (live updates)
    .delete(protect, matchController.deleteMatch);       // Delete match

// --- Match State Management ---
router.post("/:id/end-innings", protect, matchController.endInnings);    // End current innings
router.put("/:id/end", protect, validateEndMatch, matchController.endMatch); // Finalize match

module.exports = router;