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
    if (changed) {
      await sibling.save();
      matchesUpdated += 1;
    }
  }

  return { tournamentUpdated, matchesUpdated };
};

module.exports = { propagateTeamNameToTournament };
