// Caveman Food — Express server.
// Serves both the JSON API (/api/*) and the static frontend (../frontend).

const fs = require('fs')
const path = require('path')
const express = require('express')
const cors = require('cors')

const { pool } = require('./db')
const { getSettings, refreshSettings } = require('./lib/dashboard')

const app = express()

// --- middleware ----------------------------------------------------------

app.use(cors())
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
  try {
    await pool.query(sql)
    console.log('schema: applied (idempotent)')
  } catch (err) {
    console.error('schema bootstrap failed:', err.message)
    throw err
  }
}

const runSeedIfEmpty = async () => {
  // Auto-seed only when the foods table is empty AND AUTO_SEED !== 'false'.
  // Single-user V1: this gives the user a usable library on first deploy.
  if (process.env.AUTO_SEED === 'false') return
  if (!fs.existsSync(SEED_PATH)) return
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM foods')
  if (rows[0].n > 0) {
    console.log(`seed: skipped (foods table has ${rows[0].n} rows)`)
    return
  }
  const sql = fs.readFileSync(SEED_PATH, 'utf8')
  try {
    await pool.query(sql)
    console.log('seed: applied (first-run auto-seed)')
  } catch (err) {
    console.error('auto-seed failed:', err.message)
    // Non-fatal — the API still works against an empty DB.
  }
}

// --- API routes ----------------------------------------------------------

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ ok: true, time: new Date().toISOString() })
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message })
  }
})

app.use('/api/dashboard', require('./routes/dashboard'))
app.use('/api/foods', require('./routes/foods'))
app.use('/api/ingredients', require('./routes/ingredients'))
app.use('/api/stores', require('./routes/stores'))
app.use('/api/shopping', require('./routes/shopping'))
app.use('/api/prep', require('./routes/prep'))
app.use('/api/food-log', require('./routes/log'))
app.use('/api/settings', require('./routes/settings'))

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
    // No frontend yet — return a friendly message.
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
    app.locals.settings = await getSettings()
    console.log(
      `settings loaded: ${Object.keys(app.locals.settings).join(', ') || '(empty)'}`,
    )
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
