// One-off script to apply schema.sql against DATABASE_URL.
// Usage: npm run db:init
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const pool = require('../src/db/pool');

async function main() {
  const sqlPath = path.join(__dirname, '..', 'schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await pool.query(sql);
  console.log('schema.sql applied successfully.');
  await pool.end();
}

main().catch((err) => {
  console.error('Failed to apply schema:', err);
  process.exit(1);
});
