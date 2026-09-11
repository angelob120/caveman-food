// Food routes:
//   GET    /api/foods                 — list (filter ?type=full|quick|snack|prepped)
//   GET    /api/foods/:id             — one Food
//   GET    /api/foods/random          — pick a Food
//   POST   /api/foods                 — create (admin)
//   PUT    /api/foods/:id             — update (admin)
//   DELETE /api/foods/:id             — soft delete (admin)
//   POST   /api/foods/:id/eat         — log + maybe decrement prep

const express = require('express')
const { query } = require('../db')
const { requireAdmin } = require('../middleware/auth')
const { buildFood, getAllFoods } = require('../lib/dashboard')
const { costPerMealFromIngredients } = require('../lib/cost')

const router = express.Router()

// --- helpers -------------------------------------------------------------

const fetchFoodRow = async (id) => {
  const { rows } = await query('SELECT * FROM foods WHERE id = $1', [id])
  return rows[0] || null
}

const fetchIngredientRows = async (foodId) => {
  const { rows } = await query(
    `SELECT i.id, i.name, i.store_id, i.package_price, i.package_size, i.servings_per_package
       FROM food_ingredients fi
       JOIN ingredients i ON i.id = fi.ingredient_id
      WHERE fi.food_id = $1`,
    [foodId],
  )
  return rows
}

const recomputeCost = async (foodId) => {
  const ings = await fetchIngredientRows(foodId)
  return costPerMealFromIngredients(ings)
}

const ALLOWED_TYPES = ['full', 'quick', 'snack', 'prepped']
const ALLOWED_FIELDS = [
  'name',
  'image',
  'food_type',
  'cook_minutes',
  'calories',
  'instructions',
  'instructions_short',
  'meal_prep_compatible',
  'favorite',
  'active',
]

// --- public reads --------------------------------------------------------

router.get('/', async (req, res) => {
  try {
    const type = req.query.type || null
    if (type && !ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({ error: `unknown type: ${type}` })
    }
    // Public reads exclude archived (active=false). Admin can request archived.
    const includeArchived = req.query.include_archived === 'true'
    const isAdmin = req.header('x-admin-password') === (process.env.ADMIN_PASSWORD || '123')
    if (includeArchived && !isAdmin) {
      return res.status(401).json({ error: 'admin password required' })
    }
    const foods = await getAllFoods(type, { includeArchived })
    res.json(foods)
  } catch (err) {
    console.error('GET /api/foods failed:', err)
    res.status(500).json({ error: err.message || 'list failed' })
  }
})

router.get('/random', async (req, res) => {
  try {
    const foods = await getAllFoods()
    if (foods.length === 0) {
      return res.status(404).json({ error: 'no foods' })
    }
    // Ready first.
    const ready = foods.filter((f) => f.status === 'ready')
    if (ready.length > 0) {
      return res.json(ready[Math.floor(Math.random() * ready.length)])
    }
    // Otherwise cheapest missing.
    const missing = foods
      .filter((f) => f.status === 'missing')
      .sort((a, b) => a.cost_per_meal - b.cost_per_meal)
    if (missing.length > 0) {
      return res.json(missing[0])
    }
    // Final fallback: cheapest remaining food with any status.
    const fallback = [...foods].sort((a, b) => a.cost_per_meal - b.cost_per_meal)
    if (fallback.length > 0) return res.json(fallback[0])
    return res.status(404).json({ error: 'no foods' })
  } catch (err) {
    console.error('GET /api/foods/random failed:', err)
    res.status(500).json({ error: err.message || 'random failed' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' })
    const row = await fetchFoodRow(id)
    if (!row || !row.active) return res.status(404).json({ error: 'food not found' })
    const food = await buildFood(row)
    res.json(food)
  } catch (err) {
    console.error('GET /api/foods/:id failed:', err)
    res.status(500).json({ error: err.message || 'fetch failed' })
  }
})

// --- eat (mutating but allowed for everyone) -----------------------------

router.post('/:id/eat', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' })
    const source = req.body && req.body.source
    if (!['home', 'prepped'].includes(source)) {
      return res.status(400).json({ error: "source must be 'home' or 'prepped'" })
    }
    const row = await fetchFoodRow(id)
    if (!row || !row.active) return res.status(404).json({ error: 'food not found' })

    const cost = await recomputeCost(id)
    await query(
      `INSERT INTO food_log (food_id, label, source, cost)
       VALUES ($1, $2, $3, $4)`,
      [id, row.name, source, cost],
    )

    if (source === 'prepped') {
      await query(
        `UPDATE prep_inventory
            SET boxes_remaining = GREATEST(boxes_remaining - 1, 0)
          WHERE food_id = $1`,
        [id],
      )
    }

    const updated = await fetchFoodRow(id)
    const food = await buildFood(updated)
    res.json(food)
  } catch (err) {
    console.error('POST /api/foods/:id/eat failed:', err)
    res.status(500).json({ error: err.message || 'eat failed' })
  }
})

// --- admin CRUD ----------------------------------------------------------

router.post('/', requireAdmin, async (req, res) => {
  try {
    const body = req.body || {}
    if (!body.name || !body.food_type || !body.instructions) {
      return res
        .status(400)
        .json({ error: 'name, food_type, instructions are required' })
    }
    if (!ALLOWED_TYPES.includes(body.food_type)) {
      return res.status(400).json({ error: `invalid food_type: ${body.food_type}` })
    }
    const ingredientIds = Array.isArray(body.ingredient_ids) ? body.ingredient_ids : []

    const { rows } = await query(
      `INSERT INTO foods
         (name, image, food_type, cook_minutes, calories,
          instructions, instructions_short, meal_prep_compatible, favorite, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        body.name,
        body.image || null,
        body.food_type,
        body.cook_minutes || 0,
        body.calories || null,
        body.instructions,
        body.instructions_short || null,
        !!body.meal_prep_compatible,
        !!body.favorite,
        body.active === undefined ? true : !!body.active,
      ],
    )
    const foodRow = rows[0]
    for (const ingId of ingredientIds) {
      await query(
        `INSERT INTO food_ingredients (food_id, ingredient_id)
         VALUES ($1, $2)
         ON CONFLICT (food_id, ingredient_id) DO NOTHING`,
        [foodRow.id, ingId],
      )
    }
    const built = await buildFood(foodRow)
    res.status(201).json(built)
  } catch (err) {
    console.error('POST /api/foods failed:', err)
    res.status(500).json({ error: err.message || 'create failed' })
  }
})

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' })
    const row = await fetchFoodRow(id)
    if (!row) return res.status(404).json({ error: 'food not found' })

    const body = req.body || {}
    const updates = []
    const params = []
    let i = 1
    for (const field of ALLOWED_FIELDS) {
      if (body[field] !== undefined) {
        let val = body[field]
        if (field === 'food_type' && !ALLOWED_TYPES.includes(val)) {
          return res.status(400).json({ error: `invalid food_type: ${val}` })
        }
        if (
          ['cook_minutes', 'calories'].includes(field) &&
          val !== null
        ) {
          val = parseInt(val, 10)
          if (!Number.isFinite(val)) {
            return res.status(400).json({ error: `${field} must be integer` })
          }
        }
        if (
          ['meal_prep_compatible', 'favorite', 'active'].includes(field)
        ) {
          val = !!val
        }
        updates.push(`${field} = $${i++}`)
        params.push(val)
      }
    }
    if (updates.length > 0) {
      params.push(id)
      await query(
        `UPDATE foods SET ${updates.join(', ')} WHERE id = $${i}`,
        params,
      )
    }

    // Replace ingredient links if provided.
    if (Array.isArray(body.ingredient_ids)) {
      await query('DELETE FROM food_ingredients WHERE food_id = $1', [id])
      for (const ingId of body.ingredient_ids) {
        await query(
          `INSERT INTO food_ingredients (food_id, ingredient_id)
           VALUES ($1, $2)
           ON CONFLICT (food_id, ingredient_id) DO NOTHING`,
          [id, ingId],
        )
      }
    }

    const updated = await fetchFoodRow(id)
    const built = await buildFood(updated)
    res.json(built)
  } catch (err) {
    console.error('PUT /api/foods/:id failed:', err)
    res.status(500).json({ error: err.message || 'update failed' })
  }
})

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' })
    const { rowCount } = await query(
      'UPDATE foods SET active = FALSE WHERE id = $1',
      [id],
    )
    if (rowCount === 0) return res.status(404).json({ error: 'food not found' })
    res.status(204).end()
  } catch (err) {
    console.error('DELETE /api/foods/:id failed:', err)
    res.status(500).json({ error: err.message || 'delete failed' })
  }
})

module.exports = router
