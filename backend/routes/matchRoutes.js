const express = require("express");
const router = express.Router();
const matchController = require("../controllers/matchController");

router.post("/", matchController.createMatch);
router.get("/", matchController.getAllMatches);
router.get("/:id", matchController.getMatchById);
router.put("/:id", matchController.updateMatch);
router.delete("/:id", matchController.deleteMatch);
router.post("/:id/end-innings", matchController.endInnings);
router.post("/:id/end-match", matchController.endMatch);
router.post("/:id/end", matchController.endMatch);


module.exports = router;