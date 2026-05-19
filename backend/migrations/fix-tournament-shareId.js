// One-off migration: remove `shareId: null` from tournaments and rebuild the
// shareId index as a partial unique index. Safe to re-run.
//
// Run: node backend/migrations/fix-tournament-shareId.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const tournaments = mongoose.connection.db.collection('tournaments');

  const before = await tournaments.countDocuments({ shareId: null });
  console.log(`Tournaments with shareId:null before: ${before}`);

  if (before > 0) {
    const result = await tournaments.updateMany(
      { shareId: null },
      { $unset: { shareId: "" } }
    );
    console.log(`Unset shareId on ${result.modifiedCount} document(s).`);
  }

  // Drop any pre-existing shareId indexes (legacy non-partial / sparse-only).
  const existing = await tournaments.indexes();
  for (const idx of existing) {
    if (idx.key && idx.key.shareId === 1) {
      console.log(`Dropping legacy index "${idx.name}"`);
      await tournaments.dropIndex(idx.name);
    }
  }

  // Recreate as a partial unique index — only enforces uniqueness on string values.
  await tournaments.createIndex(
    { shareId: 1 },
    { unique: true, partialFilterExpression: { shareId: { $type: "string" } } }
  );
  console.log('Created partial unique index on shareId.');

  const after = await tournaments.countDocuments({ shareId: null });
  console.log(`Tournaments with shareId:null after: ${after}`);

  await mongoose.disconnect();
  console.log('Done.');
})().catch(e => { console.error(e); process.exit(1); });
