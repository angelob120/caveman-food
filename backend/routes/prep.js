// Prep inventory routes:
//   PATCH /api/prep/:foodId  (signed in) — upsert boxes_remaining + date_prepared

const express = require('express')
const { query } = require('../db')
const { requireSignedIn } = require('../middleware/auth')

const router = express.Router()

router.patch('/:foodId', requireSignedIn, async (req, res) => {
  try {
    const foodId = parseInt(req.params.foodId, 10)
    if (!Number.isFinite(foodId)) return res.status(400).json({ error: 'invalid id' })

    const body = req.body || {}
    if (body.boxes_remaining === undefined && body.date_prepared === undefined) {
      return res
        .status(400)
        .json({ error: 'boxes_remaining or date_prepared required' })
    }

    const { rows: foodRows } = await query(
      'SELECT id FROM foods WHERE id = $1 AND user_id = $2',
      [foodId, req.uid]
    )
    if (foodRows.length === 0) return res.status(404).json({ error: 'food not found' })

    // Build SET/VALUES param slots in the same order so the same params work
    // for both INSERT ... VALUES and ON CONFLICT ... SET.
    const setClauses = []
    const valueClauses = []
    const params = []
    let i = 1
    if (body.boxes_remaining !== undefined) {
      const n = parseInt(body.boxes_remaining, 10)
      if (!Number.isFinite(n) || n < 0) {
        return res
          .status(400)
          .json({ error: 'boxes_remaining must be a non-negative integer' })
      }
      setClauses.push(`boxes_remaining = $${i}`)
      valueClauses.push(`$${i}`)
      params.push(n)
      i++
    }
    if (body.date_prepared !== undefined) {
      setClauses.push(`date_prepared = $${i}`)
      valueClauses.push(`$${i}`)
      params.push(body.date_prepared || null)
      i++
    }
    // user_id for INSERT and the WHERE guard.
    params.push(req.uid, foodId)

    const userIdIdx = i++
    const foodIdIdx = i++

    const { rows } = await query(
      `INSERT INTO prep_inventory (user_id, food_id, boxes_remaining, date_prepared)
       VALUES ($${userIdIdx}, $${foodIdIdx}, ${valueClauses.join(', ')})
       ON CONFLICT (food_id) DO UPDATE
         SET ${setClauses.join(', ')}
       WHERE prep_inventory.user_id = $${userIdIdx}
       RETURNING *`,
      params
    )
    res.json(rows[0])
  } catch (err) {
    console.error('PATCH /api/prep/:foodId failed:', err)
    res.status(500).json({ error: err.message || 'prep update failed' })
  }
})

module.exports = router
