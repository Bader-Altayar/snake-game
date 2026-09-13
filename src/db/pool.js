// A single shared connection pool for the whole process.
// pg.Pool connects lazily -- creating it here does not open a connection;
// one is opened the first time a query actually runs. That's why requiring
// this module is safe even before DATABASE_URL is configured (e.g. in tests).
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  // Fires for errors on idle clients (e.g. the DB restarting), not for
  // errors on a specific query -- those reject the query's own promise.
  console.error('Unexpected error on idle PostgreSQL client', err);
});

module.exports = pool;
