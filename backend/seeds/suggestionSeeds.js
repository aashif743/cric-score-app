const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const Suggestion = require('../models/Suggestion');

// Pre-populated player names (famous cricketers)
const playerNames = [
  // India
  'Virat Kohli',
  'MS Dhoni',
  'Rohit Sharma',
  'Sachin Tendulkar',
  'Jasprit Bumrah',
  'Ravindra Jadeja',
  'Hardik Pandya',
  'KL Rahul',
  'Shubman Gill',
  'Rishabh Pant',
  'Mohammed Shami',
  'Ravichandran Ashwin',
  'Suryakumar Yadav',

  // Australia
  'Steve Smith',
  'David Warner',
  'Pat Cummins',
  'Mitchell Starc',
  'Glenn Maxwell',
  'Travis Head',
  'Marnus Labuschagne',

  // Pakistan
  'Babar Azam',
  'Shaheen Afridi',
  'Mohammad Rizwan',
  'Naseem Shah',

  // England
  'Joe Root',
  'Ben Stokes',
  'Jos Buttler',
  'Jofra Archer',
  'James Anderson',

  // New Zealand
  'Kane Williamson',
  'Trent Boult',
  'Tim Southee',

  // South Africa
  'Quinton de Kock',
  'Kagiso Rabada',
  'Aiden Markram',

  // West Indies
  'Andre Russell',
  'Nicholas Pooran',
  'Shimron Hetmyer',

  // Sri Lanka
  'Wanindu Hasaranga',
  'Pathum Nissanka',

  // Bangladesh
  'Shakib Al Hasan',
  'Mushfiqur Rahim',

  // Afghanistan
  'Rashid Khan',
  'Mohammad Nabi',
];

// Pre-populated team names
const teamNames = [
  // International Teams
  'India',
  'Australia',
  'England',
  'Pakistan',
  'New Zealand',
  'South Africa',
  'West Indies',
  'Sri Lanka',
  'Bangladesh',
  'Afghanistan',
  'Zimbabwe',
  'Ireland',
  'Netherlands',
  'Scotland',
  'Nepal',
  'USA',

  // IPL Teams
  'Mumbai Indians',
  'Chennai Super Kings',
  'Royal Challengers Bangalore',
  'Kolkata Knight Riders',
  'Delhi Capitals',
  'Punjab Kings',
  'Rajasthan Royals',
  'Sunrisers Hyderabad',
  'Gujarat Titans',
  'Lucknow Super Giants',

  // Common Team Names for Local Matches
  'Warriors',
  'Strikers',
  'Titans',
  'Lions',
  'Eagles',
  'Gladiators',
  'Knights',
  'Kings',
  'Royals',
  'Superstars',
  'Thunder',
  'Storm',
  'Phoenix',
  'Dragons',
  'Rockets',
  'Blasters',
  'Challengers',
  'Champions',
  'Legends',
  'Vikings',

  // Generic Team Names
  'Team A',
  'Team B',
  'Home Team',
  'Away Team',
  'Blue Team',
  'Red Team',
  'Green Team',
  'Yellow Team',
];

const seedSuggestions = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing seeded suggestions (keep user-added ones)
    await Suggestion.deleteMany({ isSeeded: true });
    console.log('Cleared existing seeded suggestions');

    // Prepare player suggestions
    // Lower initial counts so user-added names can easily rank higher
    const playerSuggestions = playerNames.map((name, index) => ({
      name,
      type: 'player',
      normalizedName: name.toLowerCase(),
      usageCount: Math.max(10 - Math.floor(index / 5), 2), // Start at 10, decrease slowly
      isSeeded: true,
    }));

    // Prepare team suggestions
    const teamSuggestions = teamNames.map((name, index) => ({
      name,
      type: 'team',
      normalizedName: name.toLowerCase(),
      usageCount: Math.max(10 - Math.floor(index / 5), 2), // Start at 10, decrease slowly
      isSeeded: true,
    }));

    // Insert all suggestions
    await Suggestion.insertMany([...playerSuggestions, ...teamSuggestions]);

    console.log(`Seeded ${playerSuggestions.length} player names`);
    console.log(`Seeded ${teamSuggestions.length} team names`);
    console.log('Seeding completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding suggestions:', error);
    process.exit(1);
  }
};

seedSuggestions();
