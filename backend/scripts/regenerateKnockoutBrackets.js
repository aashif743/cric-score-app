// One-off migration: rebuild every knockout tournament's bracket with the new
// sequential "in-order + byes" seeding. Run with: node scripts/regenerateKnockoutBrackets.js
// NOTE: this resets any already-played knockout matches in those tournaments.
require('dotenv').config();
const mongoose = require('mongoose');
const { generateKnockoutBracket } = require('../utils/knockoutBracket');
const Tournament = require('../models/Tournament');
const Match = require('../models/Match');

const TBD = 'TBD';
const teamObj = (name) => ({ name, shortName: (name || TBD).substring(0, 3).toUpperCase() });
const defaultPlayers = (teamName, count) =>
  Array.from({ length: count || 11 }, (_, i) => ({
    name: `${teamName} Player ${i + 1}`,
    runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, outType: 'Not Out',
  }));
const buildInnings = (bat, bowl, ppt) => ({
  battingTeam: bat, bowlingTeam: bowl,
  runs: 0, wickets: 0, overs: '0.0', runRate: 0,
  extras: { total: 0, wides: 0, noBalls: 0, byes: 0, legByes: 0 },
  fallOfWickets: [],
  batting: defaultPlayers(bat, ppt), bowling: defaultPlayers(bowl, ppt), declared: false,
});

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const ts = await Tournament.find({ format: 'knockout' }).lean();
  let done = 0;
  for (const t of ts) {
    const teams = Array.from({ length: t.numberOfTeams }, (_, i) =>
      (t.teamNames && t.teamNames[i] && t.teamNames[i].trim()) || `Team ${String.fromCharCode(65 + i)}`);
    if (teams.length < 2) continue;

    const { matches: defs } = generateKnockoutBracket(teams);
    await Match.deleteMany({ tournament: t._id });

    const sorted = [...defs].sort((a, b) => b.round - a.round);
    const idMap = {};
    for (const def of sorted) {
      const aName = def.teamA || TBD;
      const bName = def.teamB || TBD;
      const created = await Match.create({
        user: t.user, tournament: t._id,
        teamA: teamObj(aName), teamB: teamObj(bName),
        venue: t.venue || 'Unknown Venue', matchType: 'T20',
        totalOvers: t.totalOvers, ballsPerOver: t.ballsPerOver, playersPerTeam: t.playersPerTeam,
        status: 'scheduled', round: def.round, bracketSlot: def.bracketSlot,
        nextMatchId: def.parentRound ? idMap[`${def.parentRound}_${def.parentSlot}`] : null,
        nextMatchSlot: def.parentRound ? def.parentSide : null,
        innings1: buildInnings(aName, bName, t.playersPerTeam),
      });
      idMap[`${def.round}_${def.bracketSlot}`] = created._id;
    }
    await Tournament.findByIdAndUpdate(t._id, { $set: { matchCount: defs.length } });
    done += 1;
    console.log(`regenerated: ${t.name} (${teams.length} teams, ${defs.length} games)`);
  }
  console.log(`DONE. Regenerated ${done} knockout tournaments.`);
  await mongoose.disconnect();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
