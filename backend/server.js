// Caveman Food — Express server.
//
// Apple Sign-in + multi-tenant: every record is keyed by Apple `sub`. The
// password gate is gone. The first Apple user inherits the pre-multi-tenant
// rows (user_id='') via claimLegacyRowsIfFirstUser.

const fs = require('fs')
const path = require('path')
const express = require('express')
const cors = require('cors')

const { pool } = require('./db')
const {
  startWebSignIn, finishWebSignIn, me: authMe, logout: authLogout, requireSignedIn,
} = require('./middleware/auth')

const app = express()

// --- middleware ----------------------------------------------------------

app.use(cors())
// Apple Sign-in's /auth/web/callback posts application/x-www-form-urlencoded
// (Apple's form_post response_mode). The rest of the API speaks JSON.
app.use(express.urlencoded({ extended: false, limit: '32kb' }))
app.use(express.json({ limit: '1mb' }))

// Lightweight request log (helps debugging in dev).
app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    const ms = Date.now() - start
    if (process.env.NODE_ENV !== 'production' || process.env.LOG_REQUESTS === 'true') {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${ms}ms`)
    }
  })
  next()
})

// --- schema bootstrap ----------------------------------------------------

const SCHEMA_PATH = path.join(__dirname, '..', 'db', 'schema.sql')
const SEED_PATH = path.join(__dirname, '..', 'db', 'seed.sql')

const runSchema = async () => {
  if (!fs.existsSync(SCHEMA_PATH)) {
    console.warn(`schema.sql not found at ${SCHEMA_PATH} — skipping bootstrap`)
    return
  }
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8')
  // Pre-pass: add the user_id column to any pre-existing tables. The schema
  // declares indexes on (user_id) inline, which fail on legacy DBs where the
  // table exists but is missing the column — and because the file is applied
  // as one multi-statement query, a single failure rolls the whole thing back.
  // Take the table list from the schema itself so it can't drift out of sync.
  const tables = [...sql.matchAll(/CREATE TABLE IF NOT EXISTS\s+([a-z_]+)/gi)].map((m) => m[1])
  for (const t of tables) {
    try {
      await pool.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT ''`)
    } catch { /* table doesn't exist yet — first deploy */ }
  }
  try {
    await pool.query(sql)
    console.log('schema: applied (idempotent)')
  } catch (err) {
    console.error('schema bootstrap failed:', err.message)
    throw err
  }
}

const runSeedIfEmpty = async () => {
  // Auto-seed only when NO user has any foods AND AUTO_SEED !== 'false'.
  // The first Apple user inherits these unowned rows via
  // claimLegacyRowsIfFirstUser. After that, every new user starts empty and
  // adds their own foods.
  if (process.env.AUTO_SEED === 'false') return
  if (!fs.existsSync(SEED_PATH)) return
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM foods WHERE user_id <> \'\'')
  if (rows[0].n > 0) {
    console.log(`seed: skipped (foods table has ${rows[0].n} user-owned rows)`)
    return
  }
  // Insert seed rows with user_id='' so the first Apple user inherits them.
  const sql = fs.readFileSync(SEED_PATH, 'utf8')
  try {
    await pool.query(sql)
    console.log('seed: applied (first-run auto-seed, unowned — first Apple user inherits)')
  } catch (err) {
    console.error('auto-seed failed:', err.message)
    // Non-fatal — the API still works against an empty DB.
  }
}

// --- auth routes ---------------------------------------------------------

app.get('/auth/web/start', async (req, res) => {
  await startWebSignIn(req, res)
})

app.post('/auth/web/callback', async (req, res) => {
  await finishWebSignIn(req, res, (text, params) => pool.query(text, params))
})

app.get('/auth/me', async (req, res) => {
  await authMe(req, res)
})

app.post('/auth/logout', async (req, res) => {
  authLogout(req, res)
})

// --- API routes ----------------------------------------------------------

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ ok: true, time: new Date().toISOString() })
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message })
  }
})

// Every data router is gated here as well as inside each handler. The handlers
// need their own check to get the uid they scope queries by; this mount-level
// guard is the backstop, so a route added later without one still can't serve
// another user's rows.
app.use('/api/dashboard', requireSignedIn, require('./routes/dashboard'))
app.use('/api/foods', requireSignedIn, require('./routes/foods'))
app.use('/api/ingredients', requireSignedIn, require('./routes/ingredients'))
app.use('/api/stores', requireSignedIn, require('./routes/stores'))
app.use('/api/shopping', requireSignedIn, require('./routes/shopping'))
app.use('/api/prep', requireSignedIn, require('./routes/prep'))
app.use('/api/food-log', requireSignedIn, require('./routes/log'))
app.use('/api/settings', requireSignedIn, require('./routes/settings'))

// JSON 404 for unmatched /api routes.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'not found' })
})

// --- static frontend + SPA fallback --------------------------------------

const FRONTEND_DIR = path.join(__dirname, '..', 'frontend')

app.use(express.static(FRONTEND_DIR))

// Anything that wasn't an API call and didn't match a static file → index.html.
app.get(/^\/(?!api).*/, (req, res, next) => {
  const indexPath = path.join(FRONTEND_DIR, 'index.html')
  if (!fs.existsSync(indexPath)) {
    return res.status(200).send(
      'Caveman Food API is running. Frontend not yet deployed.',
    )
  }
  res.sendFile(indexPath, (err) => {
    if (err) next(err)
  })
})

// Central error handler (last resort).
app.use((err, req, res, next) => {
  console.error('unhandled error:', err)
  if (res.headersSent) return next(err)
  res.status(500).json({ error: err.message || 'internal server error' })
})

// --- startup -------------------------------------------------------------

const PORT = parseInt(process.env.PORT, 10) || 3000

const start = async () => {
  try {
    await runSchema()
    await runSeedIfEmpty()
    console.log('caveman-food starting...')
  } catch (err) {
    console.error('startup failed:', err.message)
    process.exit(1)
  }

  app.listen(PORT, () => {
    console.log(`caveman-food API listening on :${PORT}`)
  })
}

// Graceful shutdown.
const shutdown = async (signal) => {
  console.log(`\n${signal} received, shutting down…`)
  try {
    await pool.end()
  } catch (e) {
    console.error('pool.end failed:', e.message)
  }
  process.exit(0)
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

start()
