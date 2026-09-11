// Shopping routes:
//   POST /api/shopping/from-food/:foodId
//   POST /api/shopping/bought
//
// Note: there is no GET /api/shopping — the dashboard endpoint includes it.

const express = require('express')
const { query } = require('../db')
const { buildIngredient } = require('../lib/dashboard')

const router = express.Router()

// POST /api/shopping/from-food/:foodId
//   Adds missing (have=false) ingredients of the food to the shopping list.
//   Returns { added: [ShoppingItem...], already_have: ["name",...] }.
router.post('/from-food/:foodId', async (req, res) => {
  try {
    const foodId = parseInt(req.params.foodId, 10)
    if (!Number.isFinite(foodId)) return res.status(400).json({ error: 'invalid id' })

    const { rows: foodRows } = await query('SELECT id, name FROM foods WHERE id = $1 AND active = TRUE', [foodId])
    if (foodRows.length === 0) return res.status(404).json({ error: 'food not found' })

    const { rows: ings } = await query(
      `SELECT i.id, i.name, i.store_id, s.name AS store_name,
              i.package_price, i.package_size, i.servings_per_package, i.have
         FROM food_ingredients fi
         JOIN ingredients i ON i.id = fi.ingredient_id
         LEFT JOIN stores s ON s.id = i.store_id
        WHERE fi.food_id = $1`,
      [foodId],
    )

    const added = []
    const already_have = []

    for (const ing of ings) {
      if (ing.have) {
        already_have.push(ing.name)
        continue
      }
      // Skip if there's already an unpurchased entry for this ingredient.
      const { rows: existing } = await query(
        'SELECT id FROM shopping_list WHERE ingredient_id = $1 AND purchased = FALSE',
        [ing.id],
      )
      if (existing.length > 0) continue

      const { rows: ins } = await query(
        `INSERT INTO shopping_list (ingredient_id, price, purchased)
         VALUES ($1, $2, FALSE)
         ON CONFLICT (ingredient_id, purchased) DO NOTHING
         RETURNING *`,
        [ing.id, ing.package_price],
      )
      if (ins.length === 0) continue

      added.push({
        ingredient_id: ing.id,
        name: ing.name,
        store_id: ing.store_id,
        store_name: ing.store_name,
        price: ing.package_price == null ? null : parseFloat(ing.package_price),
        purchased: false,
      })
    }

    res.json({ added, already_have })
  } catch (err) {
    console.error('POST /api/shopping/from-food/:foodId failed:', err)
    res.status(500).json({ error: err.message || 'add failed' })
  }
})

// POST /api/shopping/bought
//   Marks all unpurchased shopping items as purchased,
//   and sets those ingredients to have=true.
//   Returns the updated (now all purchased) shopping list.
router.post('/bought', async (req, res) => {
  try {
    const { rows: unpurchased } = await query(
      'SELECT id, ingredient_id FROM shopping_list WHERE purchased = FALSE',
    )
    if (unpurchased.length === 0) {
      // Nothing to do — return empty list.
      return res.json({ items: [], grand_total: 0, by_store: [] })
    }
    const ingIds = [...new Set(unpurchased.map((r) => r.ingredient_id))]

    await query('BEGIN')
    try {
      await query(
        `UPDATE shopping_list SET purchased = TRUE WHERE purchased = FALSE`,
      )
      // Mark ingredients HAVE.
      await query(
        `UPDATE ingredients SET have = TRUE WHERE id = ANY($1::int[])`,
        [ingIds],
      )
      await query('COMMIT')
    } catch (e) {
      await query('ROLLBACK')
      throw e
    }

    // Return the now-purchased list for confirmation.
    const { rows } = await query(
      `SELECT sl.id, sl.ingredient_id, sl.price, sl.purchased,
              i.name, i.store_id, s.name AS store_name
         FROM shopping_list sl
         JOIN ingredients i ON i.id = sl.ingredient_id
         LEFT JOIN stores s ON s.id = i.store_id
        WHERE sl.id = ANY($1::int[])
        ORDER BY sl.id DESC`,
      [unpurchased.map((r) => r.id)],
    )
    const items = rows.map((r) => ({
      id: r.id,
      ingredient_id: r.ingredient_id,
      name: r.name,
      store_id: r.store_id,
      store_name: r.store_name,
      price: r.price == null ? null : parseFloat(r.price),
      purchased: r.purchased,
    }))
    const grand_total = items.reduce((s, i) => s + (i.price || 0), 0)
    res.json({
      items,
      grand_total: Math.round(grand_total * 100) / 100,
      updated_ingredients: ingIds,
    })
  } catch (err) {
    console.error('POST /api/shopping/bought failed:', err)
    res.status(500).json({ error: err.message || 'bought failed' })
  }
})

module.exports = router
