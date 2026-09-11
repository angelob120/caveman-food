// Food log routes:
//   POST /api/food-log  — log an eating-out meal (admin or public)

const express = require('express')
const { query } = require('../db')

const router = express.Router()

router.post('/', async (req, res) => {
  try {
    const body = req.body || {}
    const source = body.source || 'restaurant'
    if (!['home', 'restaurant', 'prepped'].includes(source)) {
      return res.status(400).json({ error: `invalid source: ${source}` })
    }
    if (body.cost === undefined || body.cost === null) {
      return res.status(400).json({ error: 'cost is required' })
    }
    const cost = parseFloat(body.cost)
    if (!Number.isFinite(cost) || cost < 0) {
      return res.status(400).json({ error: 'cost must be a non-negative number' })
    }
    if (body.food_id !== undefined && body.food_id !== null) {
      const fid = parseInt(body.food_id, 10)
      if (!Number.isFinite(fid)) return res.status(400).json({ error: 'invalid food_id' })
      const { rows: foodRows } = await query('SELECT id FROM foods WHERE id = $1', [fid])
      if (foodRows.length === 0) return res.status(404).json({ error: 'food not found' })
    }
    const { rows } = await query(
      `INSERT INTO food_log (food_id, label, source, cost)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [body.food_id || null, body.label || null, source, cost],
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('POST /api/food-log failed:', err)
    res.status(500).json({ error: err.message || 'log failed' })
  }
})

module.exports = router
