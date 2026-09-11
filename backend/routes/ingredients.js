// Ingredient routes:
//   GET    /api/ingredients
//   POST   /api/ingredients          (admin)
//   PATCH  /api/ingredients/:id      (admin) — toggle HAVE or full update
//   DELETE /api/ingredients/:id      (admin)

const express = require('express')
const { query } = require('../db')
const { requireAdmin } = require('../middleware/auth')
const { buildIngredient, getSettings } = require('../lib/dashboard')

const router = express.Router()

const fetchIngredientRow = async (id) => {
  const { rows } = await query(
    `SELECT i.id, i.name, i.store_id, s.name AS store_name,
            i.package_price, i.package_size, i.servings_per_package, i.have
       FROM ingredients i
       LEFT JOIN stores s ON s.id = i.store_id
      WHERE i.id = $1`,
    [id],
  )
  return rows[0] || null
}

router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT i.id, i.name, i.store_id, s.name AS store_name,
              i.package_price, i.package_size, i.servings_per_package, i.have
         FROM ingredients i
         LEFT JOIN stores s ON s.id = i.store_id
         ORDER BY i.name`,
    )
    res.json(rows.map(buildIngredient))
  } catch (err) {
    console.error('GET /api/ingredients failed:', err)
    res.status(500).json({ error: err.message || 'list failed' })
  }
})

router.post('/', requireAdmin, async (req, res) => {
  try {
    const body = req.body || {}
    const required = ['name', 'package_price', 'package_size', 'servings_per_package']
    for (const f of required) {
      if (body[f] === undefined || body[f] === null || body[f] === '') {
        return res.status(400).json({ error: `${f} is required` })
      }
    }
    const { rows } = await query(
      `INSERT INTO ingredients
         (name, store_id, package_price, package_size, servings_per_package, have)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        body.name,
        body.store_id || null,
        body.package_price,
        body.package_size,
        body.servings_per_package,
        body.have === undefined ? true : !!body.have,
      ],
    )
    const enriched = await fetchIngredientRow(rows[0].id)
    res.status(201).json(buildIngredient(enriched))
  } catch (err) {
    console.error('POST /api/ingredients failed:', err)
    res.status(500).json({ error: err.message || 'create failed' })
  }
})

router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' })
    const existing = await fetchIngredientRow(id)
    if (!existing) return res.status(404).json({ error: 'ingredient not found' })

    const body = req.body || {}
    const updates = []
    const params = []
    let i = 1

    // Special case: { have } alone toggles inventory state.
    if (Object.prototype.hasOwnProperty.call(body, 'have') && Object.keys(body).length === 1) {
      await query('UPDATE ingredients SET have = $1 WHERE id = $2', [!!body.have, id])
    } else {
      if (body.name !== undefined) {
        updates.push(`name = $${i++}`)
        params.push(body.name)
      }
      if (body.store_id !== undefined) {
        updates.push(`store_id = $${i++}`)
        params.push(body.store_id || null)
      }
      if (body.package_price !== undefined) {
        updates.push(`package_price = $${i++}`)
        params.push(body.package_price)
      }
      if (body.package_size !== undefined) {
        updates.push(`package_size = $${i++}`)
        params.push(body.package_size)
      }
      if (body.servings_per_package !== undefined) {
        updates.push(`servings_per_package = $${i++}`)
        params.push(body.servings_per_package)
      }
      if (body.have !== undefined) {
        updates.push(`have = $${i++}`)
        params.push(!!body.have)
      }
      if (updates.length === 0) {
        return res.status(400).json({ error: 'no fields to update' })
      }
      params.push(id)
      await query(
        `UPDATE ingredients SET ${updates.join(', ')} WHERE id = $${i}`,
        params,
      )
    }

    const updated = await fetchIngredientRow(id)
    res.json(buildIngredient(updated))
  } catch (err) {
    console.error('PATCH /api/ingredients/:id failed:', err)
    res.status(500).json({ error: err.message || 'update failed' })
  }
})

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' })
    const { rowCount } = await query('DELETE FROM ingredients WHERE id = $1', [id])
    if (rowCount === 0) return res.status(404).json({ error: 'ingredient not found' })
    res.status(204).end()
  } catch (err) {
    console.error('DELETE /api/ingredients/:id failed:', err)
    res.status(500).json({ error: err.message || 'delete failed' })
  }
})

module.exports = router
