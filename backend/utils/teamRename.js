// Shared helper: rename a team across a tournament and all of its matches.
// Updates:
//   - Tournament.teamNames (the canonical list)
//   - Match.teamA / Match.teamB references
//   - Match.innings1 / innings2 battingTeam / bowlingTeam
//
// Idempotent — repeat calls with the same oldName→newName are a no-op once
// nothing references oldName anymore.

const Match = require("../models/Match");
const Tournament = require("../models/Tournament");

const propagateTeamNameToTournament = async (tournamentId, oldName, newName) => {
  if (!tournamentId || !oldName || !newName || oldName === newName) {
    return { tournamentUpdated: false, matchesUpdated: 0 };
  }

  let tournamentUpdated = false;
  let matchesUpdated = 0;

  const tournament = await Tournament.findById(tournamentId);
  if (tournament) {
    // SAFETY GUARD: never rename a team to a name another team already uses.
    // That isn't a rename — it's a merge that collapses two teams into one and
    // silently drops a team from the groups/standings. This path is reached
    // directly from updateMatch (which bypasses the rename endpoint's own
    // conflict check) when a tournament match is started with the batting/bowling
    // teams swapped, so the fixture's teamA/teamB names look "changed". Refuse it.
    const clashes = (tournament.teamNames || []).some(
      (n) => n && n !== oldName && n.trim().toLowerCase() === newName.trim().toLowerCase(),
    );
    if (clashes) {
      return { tournamentUpdated: false, matchesUpdated: 0, skipped: 'name-already-exists' };
    }
    const idx = tournament.teamNames.indexOf(oldName);
    if (idx !== -1) {
      tournament.teamNames[idx] = newName;
      tournamentUpdated = true;
    }
    // Also rename inside the persisted groups — the Points Table reads team
    // names from here, so skipping this left the standings showing the old name.
    if (Array.isArray(tournament.groups)) {
      let groupsChanged = false;
      tournament.groups = tournament.groups.map((g) =>
        (Array.isArray(g) ? g.map((n) => { if (n === oldName) { groupsChanged = true; return newName; } return n; }) : g)
      );
      if (groupsChanged) {
        tournament.markModified('groups');
        tournamentUpdated = true;
      }
    }
    // Move the team's crest so the logo follows the team through a rename
    // (teamLogos is keyed by name). Map on older docs may be undefined.
    if (tournament.teamLogos && typeof tournament.teamLogos.get === "function") {
      const logo = tournament.teamLogos.get(oldName);
      if (logo !== undefined) {
        tournament.teamLogos.set(newName, logo);
        tournament.teamLogos.delete(oldName);
        tournament.markModified("teamLogos");
        tournamentUpdated = true;
      }
    }
    if (tournamentUpdated) await tournament.save();
  }

  const siblingMatches = await Match.find({
    tournament: tournamentId,
    $or: [{ "teamA.name": oldName }, { "teamB.name": oldName }],
  });

  for (const sibling of siblingMatches) {
    let changed = false;

    if (sibling.teamA?.name === oldName) {
      sibling.teamA.name = newName;
      sibling.teamA.shortName = newName.substring(0, 3).toUpperCase();
      changed = true;
    }
    if (sibling.teamB?.name === oldName) {
      sibling.teamB.name = newName;
      sibling.teamB.shortName = newName.substring(0, 3).toUpperCase();
      changed = true;
    }
    if (sibling.innings1) {
      if (sibling.innings1.battingTeam === oldName) { sibling.innings1.battingTeam = newName; changed = true; }
      if (sibling.innings1.bowlingTeam === oldName) { sibling.innings1.bowlingTeam = newName; changed = true; }
    }
    if (sibling.innings2) {
      if (sibling.innings2.battingTeam === oldName) { sibling.innings2.battingTeam = newName; changed = true; }
      if (sibling.innings2.bowlingTeam === oldName) { sibling.innings2.bowlingTeam = newName; changed = true; }
    }
    // The result string ("Team A won by …") and the winner also carry the name.
    if (sibling.result && sibling.result.includes(oldName)) {
      sibling.result = sibling.result.split(oldName).join(newName);
      changed = true;
    }
    if (sibling.matchSummary && sibling.matchSummary.winner === oldName) {
      sibling.matchSummary.winner = newName;
      sibling.markModified("matchSummary");
      changed = true;
    }
    if (changed) {
      await sibling.save();
      matchesUpdated += 1;
    }
  }

  return { tournamentUpdated, matchesUpdated };
};

module.exports = { propagateTeamNameToTournament };
