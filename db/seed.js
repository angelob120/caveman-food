#!/usr/bin/env node
// db/seed.js — runs schema.sql then seed.sql against $DATABASE_URL.
// Idempotent. Exits 0 on success, non-zero on failure.
//
// Usage:
//   DATABASE_URL=postgres://localhost/caveman node db/seed.js
//   DATABASE_URL=... node db/seed.js           # (schema + seed, full reset of structure)
//   DATABASE_URL=... node db/seed.js --seed    # (skip schema, just seed)

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = new Set(process.argv.slice(2));
const skipSchema = args.has('--seed') || args.has('--seed-only');

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ DATABASE_URL is not set. Aborting.');
  process.exit(1);
}

const dbDir = __dirname;
const schemaFile = path.join(dbDir, 'schema.sql');
const seedFile = path.join(dbDir, 'seed.sql');

if (!fs.existsSync(schemaFile)) {
  console.error(`❌ Missing ${schemaFile}`);
  process.exit(1);
}
if (!fs.existsSync(seedFile)) {
  console.error(`❌ Missing ${seedFile}`);
  process.exit(1);
}

// psql env: avoid pager, force single-transaction for atomicity.
const psqlEnv = { ...process.env, PGPASSWORD: process.env.PGPASSWORD || '' };

function runPsql(label, file, extraArgs = []) {
  console.log(`▶ ${label}: ${path.relative(process.cwd(), file) || file}`);
  try {
    execFileSync(
      'psql',
      ['--no-psqlrc', '-v', 'ON_ERROR_STOP=1', ...extraArgs, '-f', file, dbUrl],
      { stdio: 'inherit', env: psqlEnv }
    );
    console.log(`✅ ${label} complete\n`);
  } catch (err) {
    console.error(`❌ ${label} failed: ${err.message}`);
    process.exit(1);
  }
}

// 1. Schema — wrap in a single transaction for atomicity.
//    (schema.sql has no explicit BEGIN/COMMIT.)
if (!skipSchema) {
  runPsql('Schema', schemaFile, ['--single-transaction']);
} else {
  console.log('⏭  Skipping schema (--seed flag set)\n');
}

// 2. Seed (idempotent — re-runs are safe). seed.sql already has
//    BEGIN/COMMIT for atomicity, so don't wrap with --single-transaction
//    (would trigger "there is already a transaction in progress" warning).
runPsql('Seed', seedFile);

// 3. Final counts
const countsSql =
  "SELECT 'foods' AS k, COUNT(*)::int AS v FROM foods " +
  "UNION ALL SELECT 'ingredients', COUNT(*)::int FROM ingredients " +
  "UNION ALL SELECT 'stores', COUNT(*)::int FROM stores " +
  "UNION ALL SELECT 'food_ingredients', COUNT(*)::int FROM food_ingredients;";

let countsOutput = '';
try {
  countsOutput = execFileSync(
    'psql',
    ['--no-psqlrc', '-t', '-A', '-F', '|', '-c', countsSql, dbUrl],
    { stdio: ['ignore', 'pipe', 'inherit'], env: psqlEnv }
  ).toString();
} catch (err) {
  console.error(`❌ Failed to read counts: ${err.message}`);
  process.exit(1);
}

const counts = {};
for (const line of countsOutput.trim().split('\n')) {
  if (!line) continue;
  const [k, v] = line.split('|');
  counts[k] = parseInt(v, 10);
}

const f = counts.foods ?? 0;
const i = counts.ingredients ?? 0;
const s = counts.stores ?? 0;
const fi = counts.food_ingredients ?? 0;

console.log(`✅ Seeded ${f} foods, ${i} ingredients, ${s} stores (${fi} food-ingredient links).`);
process.exit(0);
