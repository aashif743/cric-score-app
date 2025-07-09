const express = require("express");
const router = express.Router();
const matchController = require("../controllers/matchController");

// Import the authentication middleware
const { protect } = require('../middleware/authMiddleware');

// Apply the 'protect' middleware to all routes.
// Now, a user must be logged in to perform any of these actions.

// The route to create a new match.
router.post("/", protect, matchController.createMatch);

// The route to get all matches for the LOGGED-IN user.
// Note the change from getAllMatches to getMyMatches.
router.get("/", protect, matchController.getMyMatches);

// Routes for a specific match, all protected.
router.get("/:id", protect, matchController.getMatchById);
router.put("/:id", protect, matchController.updateMatch);
router.delete("/:id", protect, matchController.deleteMatch);

// Routes for managing match state, all protected.
router.post("/:id/end-innings", protect, matchController.endInnings);
router.post("/:id/end-match", protect, matchController.endMatch);
router.post("/:id/end", protect, matchController.endMatch); // This was in your original file


module.exports = router;