// Settings routes (per-user, signed in):
//   GET   /api/settings
//   PATCH /api/settings

const express = require('express')
const { query } = require('../db')
const { requireSignedIn } = require('../middleware/auth')
const { getSettings } = require('../lib/dashboard')

const router = express.Router()

const NUMERIC_KEYS = ['full_prep_target', 'snack_prep_target', 'monthly_food_target']

router.get('/', requireSignedIn, async (req, res) => {
  try {
    const settings = await getSettings(req.uid)
    res.json(settings)
  } catch (err) {
    console.error('GET /api/settings failed:', err)
    res.status(500).json({ error: err.message || 'settings fetch failed' })
  }
})

router.patch('/', requireSignedIn, async (req, res) => {
  try {
    const body = req.body || {}

    const pairs = []
    for (const key of NUMERIC_KEYS) {
      if (body[key] !== undefined) {
        const n = parseInt(body[key], 10)
        if (!Number.isFinite(n) || n < 0) {
          return res.status(400).json({ error: `${key} must be a non-negative integer` })
        }
        pairs.push([key, String(n)])
      }
    }
    if (pairs.length === 0) {
      return res.status(400).json({ error: 'no recognized fields to update' })
    }

    // Upsert each (user_id, key) pair. ON CONFLICT keeps the PK (user_id, key).
    for (const [key, value] of pairs) {
      await query(
        `INSERT INTO settings (user_id, key, value) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value`,
        [req.uid, key, value]
      )
    }
    const settings = await getSettings(req.uid)
    res.json(settings)
  } catch (err) {
    console.error('PATCH /api/settings failed:', err)
    res.status(500).json({ error: err.message || 'settings update failed' })
  }
})

module.exports = router
