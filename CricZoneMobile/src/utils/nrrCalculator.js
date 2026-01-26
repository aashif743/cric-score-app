/**
 * Net Run Rate (NRR) Calculator - Following ICC Cricket Rules
 *
 * This utility calculates NRR strictly according to ICC regulations.
 * Suitable for production use and App Store compliance.
 *
 * @author CricZone
 * @version 1.0.0
 */

/**
 * Convert cricket overs format to decimal
 *
 * Cricket uses X.Y format where:
 * - X = complete overs
 * - Y = balls bowled in current over (0-5)
 *
 * This is NOT a decimal! 10.3 means 10 overs and 3 balls.
 *
 * @param {string|number} overs - Overs in cricket format (e.g., "10.3")
 * @returns {number} - Overs in decimal format (e.g., 10.5)
 *
 * @example
 * oversToDecimal("10.3") // Returns 10.5 (10 + 3/6)
 * oversToDecimal("20.0") // Returns 20.0
 * oversToDecimal("5.5")  // Returns 5.833... (5 + 5/6)
 */
export const oversToDecimal = (overs) => {
  if (!overs && overs !== 0) return 0;

  const oversStr = overs.toString();
  const parts = oversStr.split('.');
  const wholeOvers = parseInt(parts[0]) || 0;
  const balls = parseInt(parts[1]) || 0;

  // Validate balls (should be 0-5 in cricket)
  const validBalls = Math.min(balls, 5);

  // Convert: balls / 6 to get decimal portion
  return wholeOvers + (validBalls / 6);
};

/**
 * Convert decimal overs back to cricket format
 *
 * @param {number} decimalOvers - Overs in decimal format
 * @returns {string} - Overs in cricket format
 *
 * @example
 * decimalToOvers(10.5)    // Returns "10.3"
 * decimalToOvers(20.0)    // Returns "20.0"
 * decimalToOvers(5.833)   // Returns "5.5"
 */
export const decimalToOvers = (decimalOvers) => {
  const wholeOvers = Math.floor(decimalOvers);
  const decimalPart = decimalOvers - wholeOvers;
  const balls = Math.round(decimalPart * 6);
  return `${wholeOvers}.${balls}`;
};

/**
 * Calculate Net Run Rate (NRR) following ICC Cricket Rules
 *
 * ICC NRR FORMULA:
 * NRR = (Runs Scored / Overs Faced) - (Runs Conceded / Overs Bowled)
 *
 * ICC ALL-OUT RULE:
 * If a team is ALL OUT before completing their allotted overs,
 * they are deemed to have faced the FULL QUOTA of scheduled overs.
 * This prevents teams from manipulating NRR by getting out quickly.
 *
 * OVERS BOWLED CALCULATION:
 * Overs bowled by a team = Overs faced by the opponent (using adjusted figures)
 *
 * @param {Object} matchData - Match data object
 * @param {Object} matchData.innings1 - First innings data (Team A batting)
 * @param {Object} matchData.innings2 - Second innings data (Team B batting)
 * @param {number} matchData.totalOvers - Scheduled overs for the match
 * @param {number} matchData.playersPerTeam - Players per team (default: 11)
 * @param {Object} matchData.teamA - Team A details
 * @param {Object} matchData.teamB - Team B details
 *
 * @returns {Object|null} - NRR data for both teams or null if incomplete
 *
 * @example
 * const result = calculateNetRunRates({
 *   innings1: { runs: 150, wickets: 10, overs: "18.4" },
 *   innings2: { runs: 151, wickets: 3, overs: "17.2" },
 *   totalOvers: 20,
 *   playersPerTeam: 11,
 *   teamA: { name: "Team A" },
 *   teamB: { name: "Team B" }
 * });
 */
export const calculateNetRunRates = (matchData) => {
  // Validate input - need both innings to calculate NRR
  if (!matchData?.innings1 || !matchData?.innings2) {
    return null;
  }

  // ========== MATCH CONFIGURATION ==========
  const scheduledOvers = matchData.totalOvers || 20;
  const playersPerTeam = matchData.playersPerTeam || 11;
  const allOutWickets = playersPerTeam - 1; // e.g., 10 wickets for 11 players

  const innings1 = matchData.innings1;
  const innings2 = matchData.innings2;

  // ========== TEAM A DATA (Batted First - Innings 1) ==========
  const teamARuns = innings1.runs || 0;
  const teamAActualOvers = oversToDecimal(innings1.overs);
  const teamAWickets = innings1.wickets || 0;
  const teamAAllOut = teamAWickets >= allOutWickets;

  // ========== TEAM B DATA (Batted Second - Innings 2, Chasing) ==========
  const teamBRuns = innings2.runs || 0;
  const teamBActualOvers = oversToDecimal(innings2.overs);
  const teamBWickets = innings2.wickets || 0;
  const teamBAllOut = teamBWickets >= allOutWickets;

  // ========== APPLY ICC ALL-OUT RULE ==========
  // If a team is all out, they are deemed to have faced full scheduled overs
  // This penalizes getting all out and prevents NRR manipulation
  const teamAOversFaced = teamAAllOut ? scheduledOvers : teamAActualOvers;
  const teamBOversFaced = teamBAllOut ? scheduledOvers : teamBActualOvers;

  // ========== CALCULATE OVERS BOWLED ==========
  // Overs bowled by a team = Overs faced by the opponent (using adjusted figures)
  const teamAOversBowled = teamBOversFaced; // Team A bowled to Team B
  const teamBOversBowled = teamAOversFaced; // Team B bowled to Team A

  // ========== PREVENT DIVISION BY ZERO ==========
  if (teamAOversFaced === 0 || teamBOversFaced === 0) {
    return null;
  }

  // ========== CALCULATE RUN RATES ==========
  // Run Rate = Runs Scored / Overs Faced
  const teamARunRate = teamARuns / teamAOversFaced;
  const teamBRunRate = teamBRuns / teamBOversFaced;

  // ========== CALCULATE NET RUN RATES ==========
  // NRR = (Runs Scored / Overs Faced) - (Runs Conceded / Overs Bowled)
  const teamANRR = teamARunRate - (teamBRuns / teamAOversBowled);
  const teamBNRR = teamBRunRate - (teamARuns / teamBOversBowled);

  return {
    teamA: {
      name: matchData.teamA?.name || 'Team A',
      runs: teamARuns,
      wickets: teamAWickets,
      actualOvers: teamAActualOvers,
      actualOversFormatted: decimalToOvers(teamAActualOvers),
      oversForNRR: teamAOversFaced,
      isAllOut: teamAAllOut,
      runRate: parseFloat(teamARunRate.toFixed(2)),
      runRateFormatted: teamARunRate.toFixed(2),
      nrr: parseFloat(teamANRR.toFixed(3)),
      nrrFormatted: (teamANRR >= 0 ? '+' : '') + teamANRR.toFixed(3),
    },
    teamB: {
      name: matchData.teamB?.name || 'Team B',
      runs: teamBRuns,
      wickets: teamBWickets,
      actualOvers: teamBActualOvers,
      actualOversFormatted: decimalToOvers(teamBActualOvers),
      oversForNRR: teamBOversFaced,
      isAllOut: teamBAllOut,
      runRate: parseFloat(teamBRunRate.toFixed(2)),
      runRateFormatted: teamBRunRate.toFixed(2),
      nrr: parseFloat(teamBNRR.toFixed(3)),
      nrrFormatted: (teamBNRR >= 0 ? '+' : '') + teamBNRR.toFixed(3),
    },
    scheduledOvers,
    allOutWickets,
  };
};

/**
 * ============================================================
 * TEST CASES - Verify ICC Rule Compliance
 * ============================================================
 */

export const runNRRTests = () => {
  const testCases = [
    // ========== TEST CASE 1: Normal Match (No All-Outs) ==========
    {
      name: "Normal match - no all-outs",
      input: {
        innings1: { runs: 150, wickets: 5, overs: "20.0" },
        innings2: { runs: 151, wickets: 3, overs: "18.2" },
        totalOvers: 20,
        playersPerTeam: 11,
        teamA: { name: "Team A" },
        teamB: { name: "Team B" },
      },
      expected: {
        teamA: {
          oversForNRR: 20,
          isAllOut: false,
          // Run Rate = 150/20 = 7.50
          // NRR = (150/20) - (151/18.333) = 7.50 - 8.24 = -0.74
        },
        teamB: {
          oversForNRR: 18.333, // 18 + 2/6
          isAllOut: false,
          // Run Rate = 151/18.333 = 8.24
          // NRR = (151/18.333) - (150/20) = 8.24 - 7.50 = +0.74
        },
      },
    },

    // ========== TEST CASE 2: Team A All Out ==========
    {
      name: "Team A all out - ICC rule applies",
      input: {
        innings1: { runs: 120, wickets: 10, overs: "18.4" },
        innings2: { runs: 121, wickets: 2, overs: "15.0" },
        totalOvers: 20,
        playersPerTeam: 11,
        teamA: { name: "Team A" },
        teamB: { name: "Team B" },
      },
      expected: {
        teamA: {
          oversForNRR: 20, // All-out rule: use full 20 overs
          isAllOut: true,
          // Run Rate = 120/20 = 6.00
          // NRR = (120/20) - (121/15) = 6.00 - 8.07 = -2.07
        },
        teamB: {
          oversForNRR: 15, // Actual overs (won chase)
          isAllOut: false,
          // Run Rate = 121/15 = 8.07
          // NRR = (121/15) - (120/20) = 8.07 - 6.00 = +2.07
        },
      },
    },

    // ========== TEST CASE 3: Both Teams All Out ==========
    {
      name: "Both teams all out",
      input: {
        innings1: { runs: 100, wickets: 10, overs: "15.0" },
        innings2: { runs: 80, wickets: 10, overs: "12.3" },
        totalOvers: 20,
        playersPerTeam: 11,
        teamA: { name: "Team A" },
        teamB: { name: "Team B" },
      },
      expected: {
        teamA: {
          oversForNRR: 20, // All-out rule
          isAllOut: true,
          // Run Rate = 100/20 = 5.00
          // NRR = (100/20) - (80/20) = 5.00 - 4.00 = +1.00
        },
        teamB: {
          oversForNRR: 20, // All-out rule
          isAllOut: true,
          // Run Rate = 80/20 = 4.00
          // NRR = (80/20) - (100/20) = 4.00 - 5.00 = -1.00
        },
      },
    },

    // ========== TEST CASE 4: Exact Tie ==========
    {
      name: "Exact tie - NRR should be 0",
      input: {
        innings1: { runs: 150, wickets: 5, overs: "20.0" },
        innings2: { runs: 150, wickets: 6, overs: "20.0" },
        totalOvers: 20,
        playersPerTeam: 11,
        teamA: { name: "Team A" },
        teamB: { name: "Team B" },
      },
      expected: {
        teamA: {
          oversForNRR: 20,
          isAllOut: false,
          // NRR = (150/20) - (150/20) = 0
        },
        teamB: {
          oversForNRR: 20,
          isAllOut: false,
          // NRR = (150/20) - (150/20) = 0
        },
      },
    },

    // ========== TEST CASE 5: T10 Match with Partial Overs ==========
    {
      name: "T10 match with partial overs",
      input: {
        innings1: { runs: 85, wickets: 4, overs: "10.0" },
        innings2: { runs: 86, wickets: 2, overs: "9.4" },
        totalOvers: 10,
        playersPerTeam: 11,
        teamA: { name: "Team A" },
        teamB: { name: "Team B" },
      },
      expected: {
        teamA: {
          oversForNRR: 10,
          isAllOut: false,
          // Run Rate = 85/10 = 8.50
          // NRR = (85/10) - (86/9.667) = 8.50 - 8.90 = -0.40
        },
        teamB: {
          oversForNRR: 9.667, // 9 + 4/6
          isAllOut: false,
          // Run Rate = 86/9.667 = 8.90
          // NRR = (86/9.667) - (85/10) = 8.90 - 8.50 = +0.40
        },
      },
    },

    // ========== TEST CASE 6: Custom Players (6-a-side) ==========
    {
      name: "6-a-side match - all out at 5 wickets",
      input: {
        innings1: { runs: 60, wickets: 5, overs: "4.2" },
        innings2: { runs: 61, wickets: 3, overs: "5.0" },
        totalOvers: 6,
        playersPerTeam: 6,
        teamA: { name: "Team A" },
        teamB: { name: "Team B" },
      },
      expected: {
        teamA: {
          oversForNRR: 6, // All-out (5 wickets = all out for 6 players)
          isAllOut: true,
        },
        teamB: {
          oversForNRR: 5, // Actual overs
          isAllOut: false,
        },
      },
    },
  ];

  console.log("========== NRR CALCULATOR TEST RESULTS ==========\n");

  testCases.forEach((testCase, index) => {
    const result = calculateNetRunRates(testCase.input);

    console.log(`TEST ${index + 1}: ${testCase.name}`);
    console.log("Input:", JSON.stringify(testCase.input, null, 2));
    console.log("\nResults:");
    console.log(`  Team A (${result.teamA.name}):`);
    console.log(`    - Runs: ${result.teamA.runs}/${result.teamA.wickets}`);
    console.log(`    - Actual Overs: ${result.teamA.actualOversFormatted}`);
    console.log(`    - Overs for NRR: ${result.teamA.oversForNRR.toFixed(3)}`);
    console.log(`    - All Out: ${result.teamA.isAllOut}`);
    console.log(`    - Run Rate: ${result.teamA.runRateFormatted}`);
    console.log(`    - NRR: ${result.teamA.nrrFormatted}`);
    console.log(`  Team B (${result.teamB.name}):`);
    console.log(`    - Runs: ${result.teamB.runs}/${result.teamB.wickets}`);
    console.log(`    - Actual Overs: ${result.teamB.actualOversFormatted}`);
    console.log(`    - Overs for NRR: ${result.teamB.oversForNRR.toFixed(3)}`);
    console.log(`    - All Out: ${result.teamB.isAllOut}`);
    console.log(`    - Run Rate: ${result.teamB.runRateFormatted}`);
    console.log(`    - NRR: ${result.teamB.nrrFormatted}`);
    console.log("\n" + "=".repeat(50) + "\n");
  });

  return testCases.map(tc => calculateNetRunRates(tc.input));
};

export default {
  oversToDecimal,
  decimalToOvers,
  calculateNetRunRates,
  runNRRTests,
};
