// Food routes:
//   GET    /api/foods                 — list (filter ?type=full|quick|snack|prepped)
//   GET    /api/foods/:id             — one Food
//   GET    /api/foods/random          — pick a Food
//   POST   /api/foods                 — create (signed in)
//   PUT    /api/foods/:id             — update (signed in)
//   DELETE /api/foods/:id             — soft delete (signed in)
//   POST   /api/foods/:id/eat         — log + maybe decrement prep
//
// All queries scoped by req.uid (Apple sub). Pre-multi-tenant rows are
// claimed by the first Apple user (see middleware/auth.js).

const express = require('express')
const { query } = require('../db')
const { requireSignedIn, attachSession } = require('../middleware/auth')
const { buildFood, getAllFoods } = require('../lib/dashboard')
const { costPerMealFromIngredients } = require('../lib/cost')

const router = express.Router()

// --- helpers -------------------------------------------------------------

const fetchFoodRow = async (userId, id) => {
  const { rows } = await query('SELECT * FROM foods WHERE id = $1 AND user_id = $2', [id, userId])
  return rows[0] || null
}

const fetchIngredientRows = async (userId, foodId) => {
  const { rows } = await query(
    `SELECT i.id, i.name, i.store_id, s.name AS store_name,
            i.package_price, i.package_size, i.servings_per_package, i.have
       FROM food_ingredients fi
       JOIN ingredients i ON i.id = fi.ingredient_id AND i.user_id = fi.user_id
       LEFT JOIN stores s ON s.id = i.store_id AND s.user_id = fi.user_id
      WHERE fi.food_id = $1 AND fi.user_id = $2`,
    [foodId, userId]
  )
  return rows
}

const recomputeCost = async (userId, foodId) => {
  const ings = await fetchIngredientRows(userId, foodId)
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
// Public reads (anonymous) — show ONLY ready-to-eat foods from the shared
// library? No — every record is per-user now. So reads require sign-in too.
router.get('/', async (req, res) => {
  const uid = await attachSession(req);
  if (!uid) return res.status(401).json({ error: 'sign-in required' });
  try {
    const type = req.query.type || null
    if (type && !ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({ error: `unknown type: ${type}` })
    }
    // Admin can request archived (anyone signed in can; we no longer have a
    // separate "admin" concept).
    const includeArchived = req.query.include_archived === 'true'
    const foods = await getAllFoods(uid, type, { includeArchived })
    res.json(foods)
  } catch (err) {
    console.error('GET /api/foods failed:', err)
    res.status(500).json({ error: err.message || 'list failed' })
  }
})

router.get('/random', async (req, res) => {
  const uid = await attachSession(req);
  if (!uid) return res.status(401).json({ error: 'sign-in required' });
  try {
    const foods = await getAllFoods(uid)
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
  const uid = await attachSession(req);
  if (!uid) return res.status(401).json({ error: 'sign-in required' });
  try {
    const id = parseInt(req.params.id, 10)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' })
    const row = await fetchFoodRow(uid, id)
    if (!row || !row.active) return res.status(404).json({ error: 'food not found' })
    const food = await buildFood(uid, row)
    res.json(food)
  } catch (err) {
    console.error('GET /api/foods/:id failed:', err)
    res.status(500).json({ error: err.message || 'fetch failed' })
  }
})

// --- eat (mutating but allowed for everyone signed in) -------------------

router.post('/:id/eat', requireSignedIn, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' })
    const source = req.body && req.body.source
    if (!['home', 'prepped'].includes(source)) {
      return res.status(400).json({ error: "source must be 'home' or 'prepped'" })
    }
    const row = await fetchFoodRow(req.uid, id)
    if (!row || !row.active) return res.status(404).json({ error: 'food not found' })

    const cost = await recomputeCost(req.uid, id)
    await query(
      `INSERT INTO food_log (user_id, food_id, label, source, cost)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.uid, id, row.name, source, cost]
    )

    if (source === 'prepped') {
      await query(
        `UPDATE prep_inventory
            SET boxes_remaining = GREATEST(boxes_remaining - 1, 0)
          WHERE food_id = $1 AND user_id = $2`,
        [id, req.uid]
      )
    }

    const updated = await fetchFoodRow(req.uid, id)
    const food = await buildFood(req.uid, updated)
    res.json(food)
  } catch (err) {
    console.error('POST /api/foods/:id/eat failed:', err)
    res.status(500).json({ error: err.message || 'eat failed' })
  }
})

// --- signed-in CRUD ------------------------------------------------------

router.post('/', requireSignedIn, async (req, res) => {
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
         (user_id, name, image, food_type, cook_minutes, calories,
          instructions, instructions_short, meal_prep_compatible, favorite, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        req.uid,
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
      ]
    )
    const foodRow = rows[0]
    for (const ingId of ingredientIds) {
      await query(
        `INSERT INTO food_ingredients (user_id, food_id, ingredient_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (food_id, ingredient_id) DO NOTHING`,
        [req.uid, foodRow.id, ingId]
      )
    }
    const built = await buildFood(req.uid, foodRow)
    res.status(201).json(built)
  } catch (err) {
    console.error('POST /api/foods failed:', err)
    res.status(500).json({ error: err.message || 'create failed' })
  }
})

router.put('/:id', requireSignedIn, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' })
    const row = await fetchFoodRow(req.uid, id)
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
      params.push(id, req.uid)
      await query(
        `UPDATE foods SET ${updates.join(', ')} WHERE id = $${i++} AND user_id = $${i}`,
        params
      )
    }

    // Replace ingredient links if provided.
    if (Array.isArray(body.ingredient_ids)) {
      await query('DELETE FROM food_ingredients WHERE food_id = $1 AND user_id = $2', [id, req.uid])
      for (const ingId of body.ingredient_ids) {
        await query(
          `INSERT INTO food_ingredients (user_id, food_id, ingredient_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (food_id, ingredient_id) DO NOTHING`,
          [req.uid, id, ingId]
        )
      }
    }

    const updated = await fetchFoodRow(req.uid, id)
    const built = await buildFood(req.uid, updated)
    res.json(built)
  } catch (err) {
    console.error('PUT /api/foods/:id failed:', err)
    res.status(500).json({ error: err.message || 'update failed' })
  }
})

router.delete('/:id', requireSignedIn, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' })
    const { rowCount } = await query(
      'UPDATE foods SET active = FALSE WHERE id = $1 AND user_id = $2',
      [id, req.uid]
    )
    if (rowCount === 0) return res.status(404).json({ error: 'food not found' })
    res.status(204).end()
  } catch (err) {
    console.error('DELETE /api/foods/:id failed:', err)
    res.status(500).json({ error: err.message || 'delete failed' })
  }
})

module.exports = router
