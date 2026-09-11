// PostgreSQL pool. Raw SQL via pg.Pool — no ORM.
// DATABASE_URL is parsed by node-postgres automatically.
// In production, require SSL (Railway needs it).

const { Pool, types } = require('pg')

// Parse NUMERIC (oid 1700) as JS numbers instead of strings.
types.setTypeParser(1700, (val) => (val == null ? null : parseFloat(val)))
// Parse INT8 (oid 20, bigint) as JS numbers — safe for our row counts.
types.setTypeParser(20, (val) => (val == null ? null : parseInt(val, 10)))

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === 'production' && process.env.DATABASE_SSL !== 'false'
      ? { rejectUnauthorized: false }
      : false,
  max: 10,
})

pool.on('error', (err) => {
  console.error('Unexpected pg pool error:', err)
})

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
}
