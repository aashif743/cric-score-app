const express = require("express");
const router = express.Router();
const tournamentController = require("../controllers/tournamentController");
const { protect } = require("../middleware/authMiddleware");

router.route("/")
  .post(protect, tournamentController.createTournament)
  .get(protect, tournamentController.getMyTournaments);

router.route("/:id")
  .get(protect, tournamentController.getTournamentById)
  .put(protect, tournamentController.updateTournament)
  .delete(protect, tournamentController.deleteTournament);

router.get("/:id/stats", protect, tournamentController.getTournamentStats);
router.post("/:id/share", protect, tournamentController.generateShareId);
router.patch("/:id/rename-team", protect, tournamentController.renameTeam);

module.exports = router;
