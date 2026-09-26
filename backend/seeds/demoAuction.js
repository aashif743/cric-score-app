// Seed a ready-to-test DEMO auction: 8 teams + 10 players, wired to your
// account so it shows up the moment you open the auction system.
//
// Usage (from backend/):
//   node seeds/demoAuction.js                       → attaches to DEMO_OWNER_EMAIL, else newest user
//   node seeds/demoAuction.js you@email.com         → attaches to that email
//   node seeds/demoAuction.js 0770000000            → attaches to that phone number
//
// Re-running is safe: it deletes any previous demo auction (same name, same
// owner) and its teams/players first, then recreates a fresh draft.
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const crypto = require("crypto");

dotenv.config({ path: path.join(__dirname, "../.env") });

const User = require("../models/User");
const Auction = require("../models/Auction");
const AuctionTeam = require("../models/AuctionTeam");
const AuctionPlayer = require("../models/AuctionPlayer");

const DEMO_NAME = "Demo Auction (test)";
const L = 100000;   // 1 Lakh
const CR = 10000000; // 1 Crore

// -------- 8 teams — a mix of owners/managers/retained/captains to exercise
// every path (logo vs initials, playing manager, retained cost, captain). -----
const TEAMS = [
  {
    name: "Sahara", shortName: "SAH", logoUrl: "https://api.dicebear.com/7.x/shapes/png?seed=Sahara&size=200",
    managers: [
      { name: "Aashif", email: "owner1@demo.com", isOwner: true, plays: true, price: 5 * L, photoUrl: "https://i.pravatar.cc/300?img=11" },
      { name: "Coach Naveed", plays: false, price: 0 },
    ],
    retainedPlayers: [
      { name: "Shamlan", role: "All-rounder", price: 10 * L, photoUrl: "https://i.pravatar.cc/300?img=12" },
      { name: "Hamshan", role: "Bowler", price: 8 * L, photoUrl: "https://i.pravatar.cc/300?img=13" },
    ],
    captainName: "Aashif",
  },
  {
    name: "Dark Lions", shortName: "DL", logoUrl: "https://api.dicebear.com/7.x/shapes/png?seed=DarkLions&size=200",
    managers: [{ name: "Anshaf", email: "owner2@demo.com", isOwner: true, plays: true, price: 5 * L, photoUrl: "https://i.pravatar.cc/300?img=14" }],
    retainedPlayers: [{ name: "Aadhik", role: "Batsman", price: 12 * L, photoUrl: "https://i.pravatar.cc/300?img=15" }],
    captainName: "Anshaf",
  },
  {
    name: "Super King", shortName: "SK", logoUrl: "",
    managers: [{ name: "Sahas", email: "owner3@demo.com", isOwner: true, plays: false, price: 0 }],
    retainedPlayers: [],
    captainName: "",
  },
  {
    name: "Matrix", shortName: "MTX", logoUrl: "https://api.dicebear.com/7.x/shapes/png?seed=Matrix&size=200",
    managers: [{ name: "Ishfak", email: "owner4@demo.com", isOwner: true, plays: true, price: 4 * L }],
    retainedPlayers: [],
    captainName: "Ishfak",
  },
  {
    name: "Super Eight", shortName: "S8", logoUrl: "",
    managers: [{ name: "Farhan", email: "owner5@demo.com", isOwner: true, plays: false, price: 0 }],
    retainedPlayers: [{ name: "Zaahir", role: "WK-Batsman", price: 9 * L, photoUrl: "https://i.pravatar.cc/300?img=16" }],
    captainName: "Zaahir",
  },
  {
    name: "RDX", shortName: "RDX", logoUrl: "https://api.dicebear.com/7.x/shapes/png?seed=RDX&size=200",
    managers: [{ name: "Nashan", email: "owner6@demo.com", isOwner: true, plays: true, price: 5 * L }],
    retainedPlayers: [],
    captainName: "",
  },
  {
    name: "Don Brothers", shortName: "DON", logoUrl: "",
    managers: [{ name: "Azman", email: "owner7@demo.com", isOwner: true, plays: false, price: 0 }],
    retainedPlayers: [],
    captainName: "",
  },
  {
    name: "Power Hitter", shortName: "PH", logoUrl: "https://api.dicebear.com/7.x/shapes/png?seed=PowerHitter&size=200",
    managers: [{ name: "Aslan", email: "owner8@demo.com", isOwner: true, plays: true, price: 5 * L, photoUrl: "https://i.pravatar.cc/300?img=17" }],
    retainedPlayers: [],
    captainName: "Aslan",
  },
];

// -------- 10 players up for auction — varied roles/categories/base/photos. ----
const PLAYERS = [
  { name: "Virat Kohli", role: "Batsman", category: "Marquee", basePrice: 20 * L, isOverseas: false, photoUrl: "https://i.pravatar.cc/400?img=1", stats: { matches: 254, runs: 12898, average: 57.3 } },
  { name: "Jasprit Bumrah", role: "Bowler", category: "A", basePrice: 18 * L, isOverseas: false, photoUrl: "https://i.pravatar.cc/400?img=2", stats: { matches: 89, wickets: 149, economy: 4.6 } },
  { name: "MS Dhoni", role: "WK-Batsman", category: "Marquee", basePrice: 20 * L, isOverseas: false, photoUrl: "https://i.pravatar.cc/400?img=3", stats: { matches: 350, runs: 10773, dismissals: 444 } },
  { name: "Ben Stokes", role: "All-rounder", category: "A", basePrice: 15 * L, isOverseas: true, photoUrl: "https://i.pravatar.cc/400?img=4", stats: { matches: 105, runs: 3159, wickets: 74 } },
  { name: "Rashid Khan", role: "Bowler", category: "A", basePrice: 16 * L, isOverseas: true, photoUrl: "https://i.pravatar.cc/400?img=5", stats: { matches: 80, wickets: 133, economy: 4.1 } },
  { name: "Glenn Maxwell", role: "All-rounder", category: "B", basePrice: 12 * L, isOverseas: true, photoUrl: "https://i.pravatar.cc/400?img=6", stats: { matches: 138, runs: 3990, wickets: 63 } },
  { name: "Wanindu Hasaranga", role: "All-rounder", category: "B", basePrice: 10 * L, isOverseas: true, photoUrl: "", stats: { matches: 60, wickets: 95, runs: 890 } },
  { name: "Shubman Gill", role: "Batsman", category: "B", basePrice: 12 * L, isOverseas: false, photoUrl: "https://i.pravatar.cc/400?img=8", stats: { matches: 47, runs: 2271, average: 58.2 } },
  { name: "Pathum Nissanka", role: "Batsman", category: "C", basePrice: 8 * L, isOverseas: true, photoUrl: "", stats: { matches: 44, runs: 1650, average: 41.2 } },
  { name: "Naseem Shah", role: "Bowler", category: "C", basePrice: 8 * L, isOverseas: true, photoUrl: "https://i.pravatar.cc/400?img=10", stats: { matches: 30, wickets: 52, economy: 4.9 } },
];

async function findOwner(arg) {
  const wanted = (arg || process.env.DEMO_OWNER_EMAIL || "").trim();
  if (wanted) {
    const byEmail = await User.findOne({ email: new RegExp(`^${wanted}$`, "i") });
    if (byEmail) return byEmail;
    const byPhone = await User.findOne({ phoneNumber: wanted });
    if (byPhone) return byPhone;
    console.warn(`⚠  No user matched "${wanted}" (by email or phone). Falling back to newest user.`);
  }
  const newest = await User.findOne().sort({ createdAt: -1 });
  return newest;
}

async function run() {
  const arg = process.argv[2];
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const owner = await findOwner(arg);
  if (!owner) {
    console.error("✗ No users exist in the database. Log in to the app once to create your account, then re-run.");
    process.exit(1);
  }
  console.log(`Owner: ${owner.name || "(no name)"} — ${owner.email || owner.phoneNumber} [${owner._id}]`);

  // Wipe any previous demo auction owned by this user so re-runs stay clean.
  const old = await Auction.find({ user: owner._id, name: DEMO_NAME }).select("_id");
  if (old.length) {
    const ids = old.map((a) => a._id);
    await AuctionPlayer.deleteMany({ auction: { $in: ids } });
    await AuctionTeam.deleteMany({ auction: { $in: ids } });
    await Auction.deleteMany({ _id: { $in: ids } });
    console.log(`Removed ${ids.length} previous demo auction(s).`);
  }

  const auction = await Auction.create({
    user: owner._id,
    name: DEMO_NAME,
    sport: "cricket",
    venue: "Colombo",
    visibility: "public",
    currencyCode: "INR",
    currencyFormat: "inr", // renders as Lakh/Crore — good for testing the money UI
    currencySymbol: "₹",
    status: "draft",
    settings: {
      defaultPurse: 1 * CR,
      minBid: 0,
      playersPerTeam: 3,
      squadIncludesRetained: true,
      incrementTiers: [
        { upTo: 50 * L, step: 2 * L },   // below ₹50L → +₹2L
        { upTo: 1 * CR, step: 5 * L },   // below ₹1Cr → +₹5L
        { upTo: null, step: 10 * L },    // above       → +₹10L
      ],
      minSquadSize: 1,
      maxSquadSize: 4, // low so a team hits "Full" quickly — tests the max-squad bid limit
      enforceMaxBid: true,
      biddingMode: "manual",
    },
    shareId: crypto.randomBytes(5).toString("hex"),
  });

  await AuctionTeam.insertMany(
    TEAMS.map((t, i) => {
      const owner = (t.managers || []).find((m) => m.isOwner) || {};
      return {
        auction: auction._id,
        name: t.name,
        shortName: t.shortName,
        logoUrl: t.logoUrl || "",
        ownerName: owner.name || "",
        ownerEmail: owner.email || "",
        inviteStatus: owner.email ? "pending" : "none",
        purse: 1 * CR,
        spent: 0,
        retainedPlayers: t.retainedPlayers || [],
        managers: t.managers || [],
        captainName: t.captainName || "",
        order: i,
      };
    })
  );

  await AuctionPlayer.insertMany(
    PLAYERS.map((p, i) => ({
      auction: auction._id,
      name: p.name,
      code: String(i + 1), // player IDs 1..10 — the auctioneer draws these
      photoUrl: p.photoUrl || "",
      role: p.role,
      category: p.category,
      basePrice: p.basePrice,
      isOverseas: !!p.isOverseas,
      stats: p.stats || {},
      order: i,
      status: "pending",
    }))
  );

  console.log("\n✅ Demo auction ready");
  console.log(`   Name:     ${auction.name}`);
  console.log(`   Teams:    ${TEAMS.length}   Players: ${PLAYERS.length}`);
  console.log(`   Auction:  /auctions/${auction._id}`);
  console.log(`   Share/big-screen id: ${auction.shareId}`);
  console.log(`   Status:   draft — open it, hit "Go live", and start bidding.\n`);
  process.exit(0);
}

run().catch((e) => { console.error("Seed failed:", e); process.exit(1); });
