const express = require("express");
const router = express.Router();
const publicController = require("../controllers/publicController");

router.get("/tournament/:shareId", publicController.getPublicTournament);
router.get("/tournament/:shareId/stats", publicController.getPublicTournamentStats);
router.get("/tournament/:shareId/matches", publicController.getPublicTournamentMatches);
router.get("/match/:matchId", publicController.getPublicMatch);

module.exports = router;
