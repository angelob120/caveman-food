// Settings routes:
//   GET   /api/settings   (admin)
//   PATCH /api/settings   (admin)

const express = require('express')
const { query } = require('../db')
const { requireAdmin } = require('../middleware/auth')
const { getSettings, refreshSettings } = require('../lib/dashboard')

const router = express.Router()

const NUMERIC_KEYS = ['full_prep_target', 'snack_prep_target', 'monthly_food_target']

router.get('/', requireAdmin, async (req, res) => {
  try {
    const settings = await getSettings()
    res.json(settings)
  } catch (err) {
    console.error('GET /api/settings failed:', err)
    res.status(500).json({ error: err.message || 'settings fetch failed' })
  }
})

router.patch('/', requireAdmin, async (req, res) => {
  try {
    const body = req.body || {}

    // Build a single CASE expression that handles every provided key.
    // We only want one UPDATE ... SET value = ... statement.
    const pairs = []
    if (body.admin_password !== undefined) {
      if (typeof body.admin_password !== 'string' || body.admin_password.length === 0) {
        return res.status(400).json({ error: 'admin_password must be a non-empty string' })
      }
      pairs.push(['admin_password', body.admin_password])
    }
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

    const whens = []
    const params = []
    let i = 1
    for (const [key, value] of pairs) {
      whens.push(`WHEN key = $${i} THEN $${i + 1}`)
      params.push(key, value)
      i += 2
    }

    await query(
      `UPDATE settings
          SET value = CASE ${whens.join(' ')} ELSE value END`,
      params,
    )
    await refreshSettings(req.app)
    const settings = await getSettings()
    res.json(settings)
  } catch (err) {
    console.error('PATCH /api/settings failed:', err)
    res.status(500).json({ error: err.message || 'settings update failed' })
  }
})

module.exports = router
