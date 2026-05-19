// One-off migration: collapse duplicate suggestion docs (same
// normalizedName + type), summing their usageCounts into the kept record,
// then drop the old non-unique index and create a partial unique index on
// { normalizedName, type } so the duplication can never happen again.
//
// Safe to re-run.
//
//   node backend/migrations/dedupe-suggestions.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const col = mongoose.connection.db.collection('suggestions');

  // ── 1. Merge duplicates ────────────────────────────────────────────────
  const dupes = await col.aggregate([
    { $group: {
        _id: { normalizedName: '$normalizedName', type: '$type' },
        ids: { $push: '$_id' },
        usages: { $push: '$usageCount' },
        names: { $push: '$name' },
        count: { $sum: 1 },
    }},
    { $match: { count: { $gt: 1 } } },
  ]).toArray();

  console.log(`Found ${dupes.length} duplicate group(s) to merge.`);

  for (const d of dupes) {
    const [keepId, ...removeIds] = d.ids;
    const totalUsage = (d.usages || []).reduce((sum, n) => sum + (n || 0), 0);
    // Prefer a non-empty original name on the kept record.
    const name = d.names.find(Boolean) || d.names[0];

    await col.updateOne(
      { _id: keepId },
      { $set: { usageCount: totalUsage, name, normalizedName: d._id.normalizedName, type: d._id.type } }
    );
    if (removeIds.length) {
      const del = await col.deleteMany({ _id: { $in: removeIds } });
      console.log(`  ${d._id.type}/"${d._id.normalizedName}": kept 1, deleted ${del.deletedCount}, usageCount → ${totalUsage}`);
    }
  }

  // ── 2. Replace indexes ─────────────────────────────────────────────────
  const indexes = await col.indexes();
  for (const idx of indexes) {
    // Drop any existing index on (normalizedName, type) so we can rebuild as unique.
    if (idx.name === 'normalizedName_1_type_1' || idx.name === 'type_1_normalizedName_1_usageCount_-1') {
      try {
        console.log(`Dropping index "${idx.name}"`);
        await col.dropIndex(idx.name);
      } catch (e) {
        console.warn(`  drop failed (continuing): ${e.message}`);
      }
    }
  }
  // Recreate a fast lookup index (type + normalizedName + usageCount sort).
  await col.createIndex({ type: 1, normalizedName: 1, usageCount: -1 }, { background: true });
  // The all-important uniqueness guard.
  await col.createIndex({ normalizedName: 1, type: 1 }, { unique: true, background: true });
  console.log('Indexes rebuilt (unique on normalizedName+type).');

  // ── 3. Verify ──────────────────────────────────────────────────────────
  const remaining = await col.aggregate([
    { $group: { _id: { normalizedName: '$normalizedName', type: '$type' }, c: { $sum: 1 } } },
    { $match: { c: { $gt: 1 } } },
  ]).toArray();
  console.log(`Duplicate groups remaining: ${remaining.length}`);

  await mongoose.disconnect();
  console.log('Done.');
})().catch(e => { console.error(e); process.exit(1); });
