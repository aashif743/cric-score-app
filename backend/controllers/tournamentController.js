const Tournament = require("../models/Tournament");
const Match = require("../models/Match");
const mongoose = require("mongoose");
const { nanoid } = require("nanoid");
const { generateKnockoutBracket } = require("../utils/knockoutBracket");
const { generateLeagueBracket, buildKnockoutMatches, buildQualifierPlayoff } = require("../utils/leagueBracket");
const { propagateTeamNameToTournament } = require("../utils/teamRename");

const TBD = 'TBD';
const teamObj = (name) => ({ name, shortName: (name || TBD).substring(0, 3).toUpperCase() });
const defaultPlayers = (teamName, count) =>
  Array.from({ length: count || 11 }, (_, i) => ({
    name: `${teamName} Player ${i + 1}`,
    runs: 0, balls: 0, fours: 0, sixes: 0,
    isOut: false, outType: 'Not Out',
  }));
const buildInnings = (battingTeam, bowlingTeam, playersPerTeam) => ({
  battingTeam, bowlingTeam,
  runs: 0, wickets: 0, overs: '0.0', runRate: 0,
  extras: { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0 },
  fallOfWickets: [],
  batting: defaultPlayers(battingTeam, playersPerTeam),
  bowling: defaultPlayers(bowlingTeam, playersPerTeam),
  declared: false,
});

// Wipe and rebuild every match for a league tournament from its current
// settings (groups, advancing, matches-per-pair, playoff format). Used when the
// owner edits the structure before any match has started. Throws on an invalid
// configuration (e.g. a group with < 2 teams) so the caller can surface it.
const regenerateLeagueMatches = async (tournament, userId, groupsOverride) => {
  const filledTeams = Array.from({ length: tournament.numberOfTeams }, (_, i) =>
    (tournament.teamNames?.[i]?.trim()) || `Team ${String.fromCharCode(65 + i)}`);

  const { groups, groupMatches, knockoutMatches } = generateLeagueBracket(
    filledTeams,
    tournament.numberOfGroups,
    tournament.teamsAdvancePerGroup,
    tournament.matchesPerPair,
    tournament.playoffFormat,
    groupsOverride,
  );

  await Match.deleteMany({ tournament: tournament._id });
  await Tournament.findByIdAndUpdate(tournament._id, { $set: { groups } });

  for (const gm of groupMatches) {
    await Match.create({
      user: userId, tournament: tournament._id,
      teamA: teamObj(gm.teamA), teamB: teamObj(gm.teamB),
      venue: tournament.venue || "Unknown Venue", matchType: "T20",
      totalOvers: tournament.totalOvers, ballsPerOver: tournament.ballsPerOver,
      playersPerTeam: tournament.playersPerTeam,
      status: "scheduled", stage: "group", group: gm.group, round: gm.roundInGroup,
      innings1: buildInnings(gm.teamA, gm.teamB, tournament.playersPerTeam),
    });
  }

  const koSorted = [...knockoutMatches].sort((a, b) => b.round - a.round);
  const idMap = {};
  for (const def of koSorted) {
    const created = await Match.create({
      user: userId, tournament: tournament._id,
      teamA: teamObj(TBD), teamB: teamObj(TBD),
      venue: tournament.venue || "Unknown Venue", matchType: "T20",
      totalOvers: tournament.totalOvers, ballsPerOver: tournament.ballsPerOver,
      playersPerTeam: tournament.playersPerTeam,
      status: "scheduled", stage: "knockout", round: def.round, bracketSlot: def.bracketSlot,
      matchLabel: def.matchLabel || null,
      nextMatchId: def.parentRound ? idMap[`${def.parentRound}_${def.parentSlot}`] : null,
      nextMatchSlot: def.parentRound ? def.parentSide : null,
      loserNextMatchId: def.loserParentRound ? idMap[`${def.loserParentRound}_${def.loserParentSlot}`] : null,
      loserNextMatchSlot: def.loserParentRound ? def.loserParentSide : null,
      liveState: { sourceA: def.sourceA || null, sourceB: def.sourceB || null },
      innings1: buildInnings(TBD, TBD, tournament.playersPerTeam),
    });
    idMap[`${def.round}_${def.bracketSlot}`] = created._id;
  }

  await Tournament.findByIdAndUpdate(tournament._id, {
    $set: { matchCount: groupMatches.length + knockoutMatches.length },
  });
};

// Rebuild ONLY the knockout/playoff stage from the tournament's current
// teamsAdvancePerGroup + playoffFormat, leaving the group matches (and their
// results) untouched. Used when the owner changes how many teams advance or the
// playoff format — those depend on the standings, not on any group result. Any
// already-finished group is then re-filled into the fresh bracket slots.
const regenerateKnockoutStage = async (tournament, userId) => {
  await Match.deleteMany({ tournament: tournament._id, stage: 'knockout' });
  if (!tournament.teamsAdvancePerGroup) return;

  const useQualifier = tournament.playoffFormat === 'qualifier'
    && tournament.numberOfGroups * tournament.teamsAdvancePerGroup === 4;
  const { knockoutMatches } = useQualifier
    ? buildQualifierPlayoff(tournament.numberOfGroups, tournament.teamsAdvancePerGroup)
    : buildKnockoutMatches(tournament.numberOfGroups, tournament.teamsAdvancePerGroup);

  const koSorted = [...knockoutMatches].sort((a, b) => b.round - a.round);
  const idMap = {};
  for (const def of koSorted) {
    const created = await Match.create({
      user: userId, tournament: tournament._id,
      teamA: teamObj(TBD), teamB: teamObj(TBD),
      venue: tournament.venue || "Unknown Venue", matchType: "T20",
      totalOvers: tournament.totalOvers, ballsPerOver: tournament.ballsPerOver,
      playersPerTeam: tournament.playersPerTeam,
      status: "scheduled", stage: "knockout", round: def.round, bracketSlot: def.bracketSlot,
      matchLabel: def.matchLabel || null,
      nextMatchId: def.parentRound ? idMap[`${def.parentRound}_${def.parentSlot}`] : null,
      nextMatchSlot: def.parentRound ? def.parentSide : null,
      loserNextMatchId: def.loserParentRound ? idMap[`${def.loserParentRound}_${def.loserParentSlot}`] : null,
      loserNextMatchSlot: def.loserParentRound ? def.loserParentSide : null,
      liveState: { sourceA: def.sourceA || null, sourceB: def.sourceB || null },
      innings1: buildInnings(TBD, TBD, tournament.playersPerTeam),
    });
    idMap[`${def.round}_${def.bracketSlot}`] = created._id;
  }

  // Re-fill slots from any group that has already finished.
  const { tryAdvanceLeagueGroup } = require('./matchController');
  const groupLetters = (tournament.groups || []).map((_, i) => String.fromCharCode(65 + i));
  for (const gl of groupLetters) {
    try { await tryAdvanceLeagueGroup(tournament._id, gl); } catch (e) { console.error('Re-fill error:', e.message); }
  }
};

// Create tournament
exports.createTournament = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "User not authenticated." });
    }

    const {
      name, numberOfTeams, teamNames, playersPerTeam, totalOvers, ballsPerOver,
      venue, description, format, visibility,
      // League-only:
      numberOfGroups, teamsAdvancePerGroup, matchesPerPair, playoffFormat,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Tournament name is required." });
    }
    if (!numberOfTeams || numberOfTeams < 2) {
      return res.status(400).json({ success: false, error: "At least 2 teams are required." });
    }

    const validFormats = ["quick", "knockout", "league"];
    const tournamentFormat = validFormats.includes(format) ? format : "quick";

    const tournament = await Tournament.create({
      user: req.user.id,
      name: name.trim(),
      numberOfTeams,
      teamNames: teamNames || [],
      playersPerTeam: playersPerTeam || 11,
      totalOvers: totalOvers || 20,
      ballsPerOver: ballsPerOver || 6,
      venue: venue || "",
      description: description || "",
      format: tournamentFormat,
      visibility: visibility === "private" ? "private" : "public",
      numberOfGroups: tournamentFormat === "league" ? Math.max(1, numberOfGroups || 1) : 1,
      teamsAdvancePerGroup: tournamentFormat === "league" ? Math.max(0, teamsAdvancePerGroup || 0) : 0,
      matchesPerPair: tournamentFormat === "league" ? Math.max(1, matchesPerPair || 1) : 1,
      playoffFormat: playoffFormat === "qualifier" ? "qualifier" : "knockout",
    });

    // For knockout, pre-generate the full bracket so the schedule is ready immediately.
    if (tournamentFormat === "knockout") {
      const filledTeams = Array.from({ length: numberOfTeams }, (_, i) =>
        (teamNames?.[i]?.trim()) || `Team ${String.fromCharCode(65 + i)}`
      );
      const { matches: defs } = generateKnockoutBracket(filledTeams);

      // Create from final backwards so each child knows its parent's _id.
      const sorted = [...defs].sort((a, b) => b.round - a.round);
      const idMap = {};
      for (const def of sorted) {
        const aName = def.teamA || TBD;
        const bName = def.teamB || TBD;
        const created = await Match.create({
          user: req.user.id,
          tournament: tournament._id,
          teamA: teamObj(aName),
          teamB: teamObj(bName),
          venue: tournament.venue || "Unknown Venue",
          matchType: "T20",
          totalOvers: tournament.totalOvers,
          ballsPerOver: tournament.ballsPerOver,
          playersPerTeam: tournament.playersPerTeam,
          status: "scheduled",
          round: def.round,
          bracketSlot: def.bracketSlot,
          nextMatchId: def.parentRound ? idMap[`${def.parentRound}_${def.parentSlot}`] : null,
          nextMatchSlot: def.parentRound ? def.parentSide : null,
          innings1: buildInnings(aName, bName, tournament.playersPerTeam),
        });
        idMap[`${def.round}_${def.bracketSlot}`] = created._id;
      }
      await Tournament.findByIdAndUpdate(tournament._id, { $inc: { matchCount: defs.length } });
    }

    // League: snake-divide teams into groups, generate round-robin matches per
    // group, and pre-create a cross-paired knockout bracket of TBD slots.
    if (tournamentFormat === "league") {
      const filledTeams = Array.from({ length: numberOfTeams }, (_, i) =>
        (teamNames?.[i]?.trim()) || `Team ${String.fromCharCode(65 + i)}`
      );
      const { groups, groupMatches, knockoutMatches } = generateLeagueBracket(
        filledTeams,
        tournament.numberOfGroups,
        tournament.teamsAdvancePerGroup,
        tournament.matchesPerPair,
        tournament.playoffFormat,
      );

      // Persist the group layout on the tournament so the schedule screen can
      // render groups even before any matches are played.
      await Tournament.findByIdAndUpdate(tournament._id, { $set: { groups } });

      // Create group-stage matches. These have real team names from the start.
      for (const gm of groupMatches) {
        await Match.create({
          user: req.user.id,
          tournament: tournament._id,
          teamA: teamObj(gm.teamA),
          teamB: teamObj(gm.teamB),
          venue: tournament.venue || "Unknown Venue",
          matchType: "T20",
          totalOvers: tournament.totalOvers,
          ballsPerOver: tournament.ballsPerOver,
          playersPerTeam: tournament.playersPerTeam,
          status: "scheduled",
          stage: "group",
          group: gm.group,
          round: gm.roundInGroup,
          innings1: buildInnings(gm.teamA, gm.teamB, tournament.playersPerTeam),
        });
      }

      // Create knockout-stage matches with TBD slots. Build final-first so
      // each child knows its parent's _id (same trick as knockout-only).
      const koSorted = [...knockoutMatches].sort((a, b) => b.round - a.round);
      const idMap = {};
      for (const def of koSorted) {
        const created = await Match.create({
          user: req.user.id,
          tournament: tournament._id,
          teamA: teamObj(TBD),
          teamB: teamObj(TBD),
          venue: tournament.venue || "Unknown Venue",
          matchType: "T20",
          totalOvers: tournament.totalOvers,
          ballsPerOver: tournament.ballsPerOver,
          playersPerTeam: tournament.playersPerTeam,
          status: "scheduled",
          stage: "knockout",
          round: def.round,
          bracketSlot: def.bracketSlot,
          matchLabel: def.matchLabel || null,
          nextMatchId: def.parentRound ? idMap[`${def.parentRound}_${def.parentSlot}`] : null,
          nextMatchSlot: def.parentRound ? def.parentSide : null,
          // Qualifier playoffs: the LOSER of Qualifier 1 drops into Qualifier 2.
          loserNextMatchId: def.loserParentRound ? idMap[`${def.loserParentRound}_${def.loserParentSlot}`] : null,
          loserNextMatchSlot: def.loserParentRound ? def.loserParentSide : null,
          // Source labels ("A1", "B2", …) are stashed in liveState so the
          // group-stage-complete hook knows which slot to fill.
          liveState: { sourceA: def.sourceA || null, sourceB: def.sourceB || null },
          innings1: buildInnings(TBD, TBD, tournament.playersPerTeam),
        });
        idMap[`${def.round}_${def.bracketSlot}`] = created._id;
      }

      await Tournament.findByIdAndUpdate(tournament._id, {
        $inc: { matchCount: groupMatches.length + knockoutMatches.length },
      });
    }

    res.status(201).json({ success: true, data: tournament });
  } catch (error) {
    console.error("Create tournament error:", error);
    res.status(500).json({ success: false, error: "Failed to create tournament." });
  }
};

// Get all tournaments for user
exports.getMyTournaments = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "User not authenticated." });
    }

    const tournaments = await Tournament.find({ user: req.user.id })
      .sort({ updatedAt: -1 });

    res.json({ success: true, data: tournaments });
  } catch (error) {
    console.error("Get tournaments error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch tournaments." });
  }
};

// Get tournament by ID with matches
exports.getTournamentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid tournament ID" });
    }

    const tournament = await Tournament.findById(id).lean();

    if (!tournament) {
      return res.status(404).json({ success: false, error: "Tournament not found" });
    }

    // Owner always sees their own tournament. Other signed-in users can see
    // it too as long as it's marked public — that's how the live feed +
    // public viewer screens work.
    const isOwner = tournament.user.toString() === req.user.id;
    // Block only tournaments explicitly marked private. Legacy tournaments have
    // no visibility field stored (undefined) and default to public.
    if (!isOwner && tournament.visibility === "private") {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }

    // Fetch lightweight match list for display, and full data only for in-progress matches.
    // Always include the knockout bracket fields (round/bracketSlot/nextMatch*) so the
    // KnockoutScheduleScreen can group matches by round.
    // Include `tournament` so the FullScorecard "Next Match" button can
    // route the user back into the tournament flow (otherwise the field is
    // stripped and the button falls back to a Quick-match setup).
    const BRACKET_FIELDS = 'round bracketSlot nextMatchId nextMatchSlot matchSummary tournament stage group matchLabel';
    const [completedMatches, inProgressMatches] = await Promise.all([
      Match.find({ tournament: id, status: { $in: ["completed", "abandoned"] } })
        .select(`teamA teamB status result createdAt updatedAt totalOvers ballsPerOver playersPerTeam innings1.runs innings1.wickets innings1.overs innings1.battingTeam innings2.runs innings2.wickets innings2.overs innings2.battingTeam ${BRACKET_FIELDS}`)
        .sort({ updatedAt: -1 })
        .lean(),
      Match.find({ tournament: id, status: { $in: ["scheduled", "in_progress", "innings_break"] } })
        .select(`teamA teamB status result createdAt updatedAt totalOvers ballsPerOver playersPerTeam innings1 innings2 currentState innings target toss ${BRACKET_FIELDS}`)
        .sort({ updatedAt: -1 })
        .lean(),
    ]);
    // Knockout schedules need to be ordered by round then slot, not by updatedAt.
    // Use createdAt as a stable tie-breaker for non-bracket matches.
    const matches = [...inProgressMatches, ...completedMatches];

    res.json({ success: true, data: { ...tournament, matches } });
  } catch (error) {
    console.error("Get tournament error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch tournament." });
  }
};

// Update tournament
exports.updateTournament = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid tournament ID" });
    }

    const tournament = await Tournament.findById(id);

    if (!tournament) {
      return res.status(404).json({ success: false, error: "Tournament not found" });
    }

    if (tournament.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }

    const {
      name, numberOfTeams, teamNames, playersPerTeam, totalOvers, ballsPerOver,
      venue, description, status, visibility,
      numberOfGroups, teamsAdvancePerGroup, matchesPerPair, playoffFormat,
    } = req.body;

    // Capture the current values so we can compare and only propagate fields
    // the user actually changed. This avoids touching a match's innings1
    // roster when the user merely renames the tournament.
    const before = {
      playersPerTeam: tournament.playersPerTeam,
      totalOvers: tournament.totalOvers,
      ballsPerOver: tournament.ballsPerOver,
      venue: tournament.venue,
    };

    // --- Non-structural fields (always editable) -----------------------------
    if (name !== undefined) tournament.name = name.trim();
    if (playersPerTeam !== undefined) tournament.playersPerTeam = playersPerTeam;
    if (totalOvers !== undefined) tournament.totalOvers = totalOvers;
    if (ballsPerOver !== undefined) tournament.ballsPerOver = ballsPerOver;
    if (venue !== undefined) tournament.venue = venue;
    if (description !== undefined) tournament.description = description;
    if (status !== undefined) tournament.status = status;
    if (visibility !== undefined && (visibility === "public" || visibility === "private")) {
      tournament.visibility = visibility;
    }

    // --- League structure -----------------------------------------------------
    // Two kinds of change:
    //  • GROUP change (team count / number of groups / matches-per-pair / team
    //    names) → reshapes the group stage, so the whole league is rebuilt.
    //    This clears match results, so it's owner-confirmed on the client.
    //  • KNOCKOUT-only change (teams advancing / playoff format) → depends on the
    //    final standings, not on any group result, so only the knockout stage is
    //    rebuilt and all group matches/results are preserved. Allowed any time
    //    before the playoffs themselves have started.
    let structureWarning = null;
    if (tournament.format === 'league') {
      const newGroups = numberOfGroups !== undefined ? Math.max(1, parseInt(numberOfGroups, 10) || 1) : tournament.numberOfGroups;
      const newAdvance = teamsAdvancePerGroup !== undefined ? Math.max(0, parseInt(teamsAdvancePerGroup, 10) || 0) : tournament.teamsAdvancePerGroup;
      const newMpp = matchesPerPair !== undefined ? Math.max(1, parseInt(matchesPerPair, 10) || 1) : tournament.matchesPerPair;
      let newPlayoff = tournament.playoffFormat;
      if (playoffFormat === 'qualifier' || playoffFormat === 'knockout') newPlayoff = playoffFormat;
      if (newPlayoff === 'qualifier' && newGroups * newAdvance !== 4) newPlayoff = 'knockout';
      const newTeams = numberOfTeams !== undefined ? numberOfTeams : tournament.numberOfTeams;

      const groupChanged =
        newGroups !== tournament.numberOfGroups ||
        newMpp !== tournament.matchesPerPair ||
        newTeams !== tournament.numberOfTeams;
      const knockoutChanged =
        newAdvance !== tournament.teamsAdvancePerGroup ||
        newPlayoff !== tournament.playoffFormat;

      if (groupChanged) {
        // Full rebuild — clears all matches. The client confirms before sending.
        tournament.numberOfGroups = newGroups;
        tournament.teamsAdvancePerGroup = newAdvance;
        tournament.matchesPerPair = newMpp;
        tournament.playoffFormat = newPlayoff;
        if (numberOfTeams !== undefined) tournament.numberOfTeams = numberOfTeams;
        if (teamNames !== undefined) tournament.teamNames = teamNames;
        await tournament.save();
        try {
          await regenerateLeagueMatches(tournament, req.user.id);
        } catch (e) {
          return res.status(400).json({ success: false, error: e.message || 'Invalid league configuration.' });
        }
        const fresh = await Tournament.findById(id).lean();
        return res.json({ success: true, data: fresh, regenerated: true });
      }

      if (knockoutChanged) {
        const koStarted = await Match.findOne({ tournament: id, stage: 'knockout', status: { $ne: 'scheduled' } }).lean();
        if (koStarted) {
          structureWarning = 'Teams advancing and playoff format can only be changed before the playoffs start — those changes were not applied.';
        } else {
          tournament.teamsAdvancePerGroup = newAdvance;
          tournament.playoffFormat = newPlayoff;
          await tournament.save();
          try {
            await regenerateKnockoutStage(tournament, req.user.id);
          } catch (e) {
            return res.status(400).json({ success: false, error: e.message || 'Invalid playoff configuration.' });
          }
          const fresh = await Tournament.findById(id).lean();
          return res.json({ success: true, data: fresh, regenerated: true });
        }
      }
    }

    // No structural rebuild — apply team count / names normally.
    if (numberOfTeams !== undefined) tournament.numberOfTeams = numberOfTeams;
    if (teamNames !== undefined) tournament.teamNames = teamNames;

    const updated = await tournament.save();

    // Push match-level setting changes into every scheduled match in this
    // tournament. We intentionally skip in_progress / completed matches so a
    // mid-tournament tweak can't rewrite a finished match's overs.
    const matchUpdate = {};
    if (totalOvers !== undefined && totalOvers !== before.totalOvers)
      matchUpdate.totalOvers = totalOvers;
    if (ballsPerOver !== undefined && ballsPerOver !== before.ballsPerOver)
      matchUpdate.ballsPerOver = ballsPerOver;
    if (venue !== undefined && venue !== before.venue)
      matchUpdate.venue = venue || "Unknown Venue";

    if (playersPerTeam !== undefined && playersPerTeam !== before.playersPerTeam) {
      // playersPerTeam also resizes the innings1 batting/bowling placeholders.
      // Handle that in a per-match loop rather than a single updateMany.
      matchUpdate.playersPerTeam = playersPerTeam;
      const scheduled = await Match.find({ tournament: id, status: 'scheduled' });
      for (const m of scheduled) {
        Object.assign(m, matchUpdate);
        if (m.innings1) {
          const a = m.innings1.battingTeam;
          const b = m.innings1.bowlingTeam;
          m.innings1.batting = Array.from({ length: playersPerTeam }, (_, i) => ({
            name: `${a} Player ${i + 1}`,
            runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, outType: 'Not Out',
          }));
          m.innings1.bowling = Array.from({ length: playersPerTeam }, (_, i) => ({
            name: `${b} Player ${i + 1}`,
            runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, outType: 'Not Out',
          }));
        }
        await m.save();
      }
    } else if (Object.keys(matchUpdate).length > 0) {
      await Match.updateMany(
        { tournament: id, status: 'scheduled' },
        { $set: matchUpdate },
      );
    }

    res.json({ success: true, data: updated, warning: structureWarning });
  } catch (error) {
    console.error("Update tournament error:", error);
    res.status(500).json({ success: false, error: "Failed to update tournament." });
  }
};

// Delete tournament and linked matches
exports.deleteTournament = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid tournament ID" });
    }

    const tournament = await Tournament.findById(id);

    if (!tournament) {
      return res.status(404).json({ success: false, error: "Tournament not found" });
    }

    if (tournament.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }

    // Delete all linked matches
    await Match.deleteMany({ tournament: id });

    await Tournament.findByIdAndDelete(id);

    res.json({ success: true, message: "Tournament and linked matches deleted successfully." });
  } catch (error) {
    console.error("Delete tournament error:", error);
    res.status(500).json({ success: false, error: "Failed to delete tournament." });
  }
};

// Get tournament stats
exports.getTournamentStats = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid tournament ID" });
    }

    const tournament = await Tournament.findById(id).lean();

    if (!tournament) {
      return res.status(404).json({ success: false, error: "Tournament not found" });
    }

    // Owner always; other signed-in users may view stats for non-private
    // tournaments (public live viewers), consistent with getTournament.
    if (tournament.user.toString() !== req.user.id && tournament.visibility === "private") {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }

    const tournamentObjectId = new mongoose.Types.ObjectId(id);

    // Run all queries in parallel
    const [topRunScorers, topWicketTakers, totalMatches, completedMatches, mostRunsInMatch, bestBowling] = await Promise.all([
      // Top 5 run scorers
      Match.aggregate([
        { $match: { tournament: tournamentObjectId, status: "completed" } },
        {
          $project: {
            batsmen: {
              $concatArrays: [
                {
                  $map: {
                    input: { $ifNull: ["$innings1.batting", []] },
                    as: "b",
                    in: { $mergeObjects: ["$$b", { team: "$innings1.battingTeam" }] }
                  }
                },
                {
                  $map: {
                    input: { $ifNull: ["$innings2.batting", []] },
                    as: "b",
                    in: { $mergeObjects: ["$$b", { team: "$innings2.battingTeam" }] }
                  }
                }
              ]
            }
          }
        },
        { $unwind: "$batsmen" },
        { $match: { "batsmen.name": { $not: /^Batsman \d+$/i } } },
        {
          $group: {
            _id: { name: "$batsmen.name", team: "$batsmen.team" },
            totalRuns: { $sum: "$batsmen.runs" },
            totalBalls: { $sum: "$batsmen.balls" },
            totalFours: { $sum: "$batsmen.fours" },
            totalSixes: { $sum: "$batsmen.sixes" },
            innings: { $sum: 1 }
          }
        },
        { $sort: { totalRuns: -1 } },
        { $limit: 5 },
        {
          $project: {
            _id: 0,
            name: "$_id.name",
            team: "$_id.team",
            totalRuns: 1,
            totalBalls: 1,
            totalFours: 1,
            totalSixes: 1,
            innings: 1
          }
        }
      ]),

      // Top 5 wicket takers
      Match.aggregate([
        { $match: { tournament: tournamentObjectId, status: "completed" } },
        {
          $project: {
            bowlers: {
              $concatArrays: [
                {
                  $map: {
                    input: { $ifNull: ["$innings1.bowling", []] },
                    as: "b",
                    in: { $mergeObjects: ["$$b", { team: "$innings1.bowlingTeam" }] }
                  }
                },
                {
                  $map: {
                    input: { $ifNull: ["$innings2.bowling", []] },
                    as: "b",
                    in: { $mergeObjects: ["$$b", { team: "$innings2.bowlingTeam" }] }
                  }
                }
              ]
            }
          }
        },
        { $unwind: "$bowlers" },
        { $match: { "bowlers.name": { $not: /^Bowler \d+$/i } } },
        {
          $group: {
            _id: { name: "$bowlers.name", team: "$bowlers.team" },
            totalWickets: { $sum: "$bowlers.wickets" },
            totalRuns: { $sum: "$bowlers.runs" },
            innings: { $sum: 1 }
          }
        },
        { $sort: { totalWickets: -1, totalRuns: 1 } },
        { $limit: 5 },
        {
          $project: {
            _id: 0,
            name: "$_id.name",
            team: "$_id.team",
            totalWickets: 1,
            totalRuns: 1,
            innings: 1
          }
        }
      ]),

      // Match counts
      Match.countDocuments({ tournament: tournamentObjectId }),
      Match.countDocuments({ tournament: tournamentObjectId, status: "completed" }),

      // Most runs in a match
      Match.aggregate([
        { $match: { tournament: tournamentObjectId, status: "completed" } },
        {
          $project: {
            batsmen: {
              $concatArrays: [
                {
                  $map: {
                    input: { $ifNull: ["$innings1.batting", []] },
                    as: "b",
                    in: { $mergeObjects: ["$$b", { team: "$innings1.battingTeam" }] }
                  }
                },
                {
                  $map: {
                    input: { $ifNull: ["$innings2.batting", []] },
                    as: "b",
                    in: { $mergeObjects: ["$$b", { team: "$innings2.battingTeam" }] }
                  }
                }
              ]
            },
            matchTitle: { $concat: ["$teamA.name", " vs ", "$teamB.name"] }
          }
        },
        { $unwind: "$batsmen" },
        { $match: { "batsmen.name": { $not: /^Batsman \d+$/i } } },
        { $sort: { "batsmen.runs": -1 } },
        { $limit: 1 },
        {
          $project: {
            name: "$batsmen.name",
            team: "$batsmen.team",
            runs: "$batsmen.runs",
            balls: "$batsmen.balls",
            matchTitle: 1
          }
        }
      ]),

      // Best bowling in a match
      Match.aggregate([
        { $match: { tournament: tournamentObjectId, status: "completed" } },
        {
          $project: {
            bowlers: {
              $concatArrays: [
                {
                  $map: {
                    input: { $ifNull: ["$innings1.bowling", []] },
                    as: "b",
                    in: { $mergeObjects: ["$$b", { team: "$innings1.bowlingTeam" }] }
                  }
                },
                {
                  $map: {
                    input: { $ifNull: ["$innings2.bowling", []] },
                    as: "b",
                    in: { $mergeObjects: ["$$b", { team: "$innings2.bowlingTeam" }] }
                  }
                }
              ]
            },
            matchTitle: { $concat: ["$teamA.name", " vs ", "$teamB.name"] }
          }
        },
        { $unwind: "$bowlers" },
        { $match: { "bowlers.name": { $not: /^Bowler \d+$/i } } },
        { $sort: { "bowlers.wickets": -1, "bowlers.runs": 1 } },
        { $limit: 1 },
        {
          $project: {
            name: "$bowlers.name",
            team: "$bowlers.team",
            wickets: "$bowlers.wickets",
            runs: "$bowlers.runs",
            overs: "$bowlers.overs",
            matchTitle: 1
          }
        }
      ]),
    ]);

    res.json({
      success: true,
      data: {
        topRunScorers,
        topWicketTakers,
        totalMatches,
        completedMatches,
        mostRunsInMatch: mostRunsInMatch[0] || null,
        bestBowling: bestBowling[0] || null,
      }
    });
  } catch (error) {
    console.error("Get tournament stats error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch tournament stats." });
  }
};

// Rename a team across the whole tournament (teamNames + every linked match).
// POST /api/tournaments/:id/rename-team   body: { oldName, newName }
exports.renameTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const { oldName, newName } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid tournament ID" });
    }
    if (!oldName || !newName || !oldName.trim() || !newName.trim()) {
      return res.status(400).json({ success: false, error: "oldName and newName are required" });
    }
    if (oldName === newName) {
      return res.json({ success: true, data: { tournamentUpdated: false, matchesUpdated: 0 } });
    }

    const tournament = await Tournament.findById(id);
    if (!tournament) {
      return res.status(404).json({ success: false, error: "Tournament not found" });
    }
    if (tournament.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }

    // Block renaming to a name another team in this tournament already uses.
    const conflictingTeam = tournament.teamNames.some(
      (n) => n && n !== oldName && n.trim().toLowerCase() === newName.trim().toLowerCase()
    );
    if (conflictingTeam) {
      return res.status(409).json({ success: false, error: `Another team is already called "${newName}".` });
    }

    const result = await propagateTeamNameToTournament(id, oldName.trim(), newName.trim());
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Rename team error:", error);
    res.status(500).json({ success: false, error: "Failed to rename team." });
  }
};

// PATCH /api/tournaments/:id/swap-teams   body: { teamA, teamB }
// Swap two teams between their groups. Only allowed before any group match has
// started (so no played result is lost). Regenerates the group + knockout
// fixtures from the swapped arrangement.
exports.swapTeamGroups = async (req, res) => {
  try {
    const { id } = req.params;
    const { teamA, teamB } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid tournament ID" });
    }
    const a = (teamA || "").trim();
    const b = (teamB || "").trim();
    if (!a || !b || a === b) {
      return res.status(400).json({ success: false, error: "Two different team names are required" });
    }

    const tournament = await Tournament.findById(id);
    if (!tournament) return res.status(404).json({ success: false, error: "Tournament not found" });
    if (tournament.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }
    if (tournament.format !== "league") {
      return res.status(400).json({ success: false, error: "Only league tournaments have groups" });
    }

    const groups = (tournament.groups || []).map((g) => [...g]);
    let ga = -1, gb = -1, ia = -1, ib = -1;
    groups.forEach((g, gi) => {
      const pa = g.indexOf(a); if (pa !== -1) { ga = gi; ia = pa; }
      const pb = g.indexOf(b); if (pb !== -1) { gb = gi; ib = pb; }
    });
    if (ga === -1 || gb === -1) {
      return res.status(404).json({ success: false, error: "Both teams must be in the tournament" });
    }
    if (ga === gb) {
      return res.status(400).json({ success: false, error: "Pick teams from two different groups" });
    }

    // Block once any group match has begun.
    const started = await Match.findOne({
      tournament: id, stage: "group", status: { $ne: "scheduled" },
    }).lean();
    if (started) {
      return res.status(409).json({ success: false, error: "Group matches have started — teams can no longer be moved between groups." });
    }

    // Trade positions, then rebuild fixtures from the new arrangement.
    groups[ga][ia] = b;
    groups[gb][ib] = a;
    await regenerateLeagueMatches(tournament, req.user.id, groups);

    const updated = await Tournament.findById(id).lean();
    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Swap teams error:", error);
    res.status(500).json({ success: false, error: "Failed to swap teams." });
  }
};

// Generate share link for tournament
exports.generateShareId = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid tournament ID" });
    }

    const tournament = await Tournament.findById(id);

    if (!tournament) {
      return res.status(404).json({ success: false, error: "Tournament not found" });
    }

    if (tournament.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }

    // If already has a shareId, return it
    if (!tournament.shareId) {
      tournament.shareId = nanoid(12);
      await tournament.save();
    }

    res.json({
      success: true,
      data: {
        shareId: tournament.shareId,
        shareUrl: `https://cric-zone.com/tournament/${tournament.shareId}`
      }
    });
  } catch (error) {
    console.error("Generate share ID error:", error);
    res.status(500).json({ success: false, error: "Failed to generate share link." });
  }
};

// PATCH /tournaments/:id/playoff-format  { playoffFormat: 'knockout' | 'qualifier' }
// Changes a league tournament's knockout-stage format and rebuilds the playoff
// matches. Allowed while the playoffs haven't started (group stage may be live).
exports.setPlayoffFormat = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid tournament ID" });
    }
    const newFormat = req.body?.playoffFormat === 'qualifier' ? 'qualifier' : 'knockout';

    const tournament = await Tournament.findById(id);
    if (!tournament) return res.status(404).json({ success: false, error: "Tournament not found" });
    if (tournament.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: "Not authorized" });
    }
    if (tournament.format !== 'league') {
      return res.status(400).json({ success: false, error: "Playoff format applies to league tournaments only." });
    }
    if (!tournament.teamsAdvancePerGroup) {
      return res.status(400).json({ success: false, error: "This tournament has no playoff stage." });
    }
    const totalAdvancing = tournament.numberOfGroups * tournament.teamsAdvancePerGroup;
    if (newFormat === 'qualifier' && totalAdvancing !== 4) {
      return res.status(400).json({ success: false, error: "Qualifier playoffs need exactly 4 qualifying teams (top 4)." });
    }

    // Can't reshuffle the bracket once a playoff match has begun.
    const startedKo = await Match.findOne({
      tournament: id, stage: 'knockout', status: { $ne: 'scheduled' },
    }).lean();
    if (startedKo) {
      return res.status(400).json({ success: false, error: "Can't change the playoff format once the playoffs have started." });
    }

    if (newFormat === tournament.playoffFormat) {
      const same = await Tournament.findById(id).lean();
      return res.json({ success: true, data: same });
    }

    // Replace the scheduled playoff matches with the new format (group matches
    // and their results are preserved).
    tournament.playoffFormat = newFormat;
    await tournament.save();
    await regenerateKnockoutStage(tournament, tournament.user);

    const updated = await Tournament.findById(id).lean();
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Set playoff format error:", error);
    res.status(500).json({ success: false, error: "Failed to update playoff format." });
  }
};
