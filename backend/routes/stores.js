// Store routes:
//   POST /api/stores  (signed in)

const express = require('express')
const { query } = require('../db')
const { requireSignedIn } = require('../middleware/auth')

const router = express.Router()

router.post('/', requireSignedIn, async (req, res) => {
  try {
    const body = req.body || {}
    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return res.status(400).json({ error: 'name is required' })
    }
    const { rows } = await query(
      `INSERT INTO stores (user_id, name, notes) VALUES ($1, $2, $3) RETURNING *`,
      [req.uid, body.name.trim(), body.notes || null]
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
