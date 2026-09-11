// Store routes:
//   POST /api/stores  (admin)

const express = require('express')
const { query } = require('../db')
const { requireAdmin } = require('../middleware/auth')

const router = express.Router()

router.post('/', requireAdmin, async (req, res) => {
  try {
    const body = req.body || {}
    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return res.status(400).json({ error: 'name is required' })
    }
    const { rows } = await query(
      `INSERT INTO stores (name, notes) VALUES ($1, $2) RETURNING *`,
      [body.name.trim(), body.notes || null],
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'store name already exists' })
    }
    console.error('POST /api/stores failed:', err)
    res.status(500).json({ error: err.message || 'create failed' })
  }
})

module.exports = router
