const express = require("express");
const router = express.Router();
const c = require("../controllers/auctionController");
const { protect } = require("../middleware/authMiddleware");

// Public read-only snapshot for the big screen / spectator link (no auth).
router.get("/public/:shareId", c.getPublicAuction);

router.route("/")
  .post(protect, c.createAuction)
  .get(protect, c.getMyAuctions);

router.route("/:id")
  .get(protect, c.getAuction)
  .patch(protect, c.updateAuction)
  .delete(protect, c.deleteAuction);

// Teams
router.post("/:id/teams", protect, c.addTeam);
router.route("/:id/teams/:teamId")
  .patch(protect, c.updateTeam)
  .delete(protect, c.deleteTeam);

// Players
router.post("/:id/players", protect, c.addPlayer);
router.post("/:id/players/bulk", protect, c.addPlayersBulk);
router.route("/:id/players/:playerId")
  .patch(protect, c.updatePlayer)
  .delete(protect, c.deletePlayer);

// Live auction actions (admin-only; each broadcasts new state to the room)
router.post("/:id/open", protect, c.openLot);
router.post("/:id/bid", protect, c.markBid);
router.post("/:id/undo", protect, c.undoBid);
router.post("/:id/sell", protect, c.sellCurrent);
router.post("/:id/unsold", protect, c.markUnsold);

// Owner bidding (online mode) — the caller must own a team in this auction
router.post("/:id/owner-bid", protect, c.ownerBid);

module.exports = router;
