// Dashboard aggregator + Food shape builder.
// One place that knows how a Food object looks, so all routes stay consistent.

const { query } = require('../db')
const { costPerMealFromIngredients, perMealCost } = require('./cost')

// Status computation:
//   ready      — 0 missing ingredients
//   missing    — 1 or 2 missing (but not all)
//   need_shop  — 3+ missing OR all missing
const computeStatus = (ingredients) => {
  if (!Array.isArray(ingredients) || ingredients.length === 0) return 'ready'
  const total = ingredients.length
  const missingCount = ingredients.filter((i) => !i.have).length
  if (missingCount === 0) return 'ready'
  if (missingCount === total) return 'need_shop'
  if (missingCount >= 3) return 'need_shop'
  return 'missing'
}

const buildIngredient = (row) => ({
  id: row.id,
  name: row.name,
  store_id: row.store_id,
  store_name: row.store_name || null,
  package_price: row.package_price == null ? null : parseFloat(row.package_price),
  package_size: row.package_size,
  servings_per_package:
    row.servings_per_package == null ? null : parseFloat(row.servings_per_package),
  per_meal_cost: perMealCost(row),
  have: row.have,
})

// Fetch the food row's ingredients (joined with store) and assemble the
// full Food shape. Always re-reads — caller should pass a fresh food row.
const buildFood = async (foodRow) => {
  const { rows } = await query(
    `SELECT i.id, i.name, i.store_id, s.name AS store_name,
            i.package_price, i.package_size, i.servings_per_package, i.have
       FROM food_ingredients fi
       JOIN ingredients i ON i.id = fi.ingredient_id
       LEFT JOIN stores s ON s.id = i.store_id
      WHERE fi.food_id = $1
      ORDER BY i.id`,
    [foodRow.id],
  )
  const ingredients = rows.map(buildIngredient)
  const missing = ingredients.filter((i) => !i.have).map((i) => i.name)
  const cost = costPerMealFromIngredients(ingredients)

  // Primary store: the store that appears on most of the food's ingredients,
  // tiebreak by lowest store_id. Falls back to null if no ingredients carry a store.
  let primaryStore = null
  if (ingredients.length > 0) {
    const counts = new Map()
    for (const ing of ingredients) {
      if (ing.store_id == null) continue
      const cur = counts.get(ing.store_id) || { count: 0, name: ing.store_name }
      cur.count += 1
      counts.set(ing.store_id, cur)
    }
    if (counts.size > 0) {
      const sorted = [...counts.entries()].sort((a, b) => {
        if (b[1].count !== a[1].count) return b[1].count - a[1].count
        return a[0] - b[0]
      })
      const [storeId, info] = sorted[0]
      primaryStore = { id: storeId, name: info.name }
    }
  }

  return {
    id: foodRow.id,
    name: foodRow.name,
    image: foodRow.image,
    food_type: foodRow.food_type,
    cook_minutes: foodRow.cook_minutes,
    calories: foodRow.calories,
    instructions_short: foodRow.instructions_short,
    instructions: foodRow.instructions,
    meal_prep_compatible: foodRow.meal_prep_compatible,
    favorite: foodRow.favorite,
    active: foodRow.active,
    cost_per_meal: cost,
    status: computeStatus(ingredients),
    missing_ingredients: missing,
    ingredients,
    primary_store: primaryStore,
  }
}

const getAllFoods = async (filterType = null) => {
  let sql
  let params = []
  if (filterType === 'prepped') {
    sql = `SELECT f.*
             FROM foods f
             JOIN prep_inventory pi ON pi.food_id = f.id
            WHERE f.active = TRUE AND pi.boxes_remaining > 0
            ORDER BY f.id`
  } else if (['full', 'quick', 'snack'].includes(filterType)) {
    sql = 'SELECT * FROM foods WHERE active = TRUE AND food_type = $1 ORDER BY id'
    params = [filterType]
  } else {
    sql = 'SELECT * FROM foods WHERE active = TRUE ORDER BY id'
  }
  const { rows } = await query(sql, params)
  return Promise.all(rows.map(buildFood))
}

// --- Settings ------------------------------------------------------------

const getSettings = async () => {
  const { rows } = await query('SELECT key, value FROM settings')
  const out = {}
  for (const r of rows) out[r.key] = r.value
  return out
}

const refreshSettings = async (app) => {
  app.locals.settings = await getSettings()
}

// --- Stats ---------------------------------------------------------------

const getWeekStats = async () => {
  const { rows } = await query(
    `SELECT
        COUNT(*) FILTER (WHERE source IN ('home','prepped'))::int AS home_meals,
        COUNT(*) FILTER (WHERE source = 'restaurant')::int        AS eating_out,
        COALESCE(SUM(cost) FILTER (WHERE source IN ('home','prepped')), 0) AS home_cost,
        COALESCE(SUM(cost) FILTER (WHERE source = 'restaurant'), 0)        AS out_cost
       FROM food_log
      WHERE eaten_at >= NOW() - INTERVAL '7 days'`,
  )
  const { rows: prepRows } = await query(
    'SELECT COALESCE(SUM(boxes_remaining),0)::int AS boxes FROM prep_inventory',
  )
  const r = rows[0]
  return {
    home_meals: r.home_meals || 0,
    eating_out: r.eating_out || 0,
    home_cost: parseFloat(r.home_cost) || 0,
    out_cost: parseFloat(r.out_cost) || 0,
    prep_boxes_left: prepRows[0].boxes || 0,
  }
}

const getMonthStats = async () => {
  const { rows } = await query(
    `SELECT
        COALESCE(SUM(cost) FILTER (WHERE source IN ('home','prepped')), 0) AS groceries,
        COALESCE(SUM(cost) FILTER (WHERE source = 'restaurant'), 0)        AS eating_out
       FROM food_log
      WHERE eaten_at >= DATE_TRUNC('month', NOW())
        AND eaten_at <  DATE_TRUNC('month', NOW()) + INTERVAL '1 month'`,
  )
  const { rows: prevRows } = await query(
    `SELECT COALESCE(SUM(cost), 0) AS total
       FROM food_log
      WHERE eaten_at >= DATE_TRUNC('month', NOW()) - INTERVAL '1 month'
        AND eaten_at <  DATE_TRUNC('month', NOW())`,
  )
  const r = rows[0]
  const groceries = parseFloat(r.groceries) || 0
  const eating_out = parseFloat(r.eating_out) || 0
  return {
    groceries,
    eating_out,
    total: groceries + eating_out,
    previous_total: parseFloat(prevRows[0].total) || 0,
  }
}

// --- Shopping aggregation -----------------------------------------------

const getShopping = async () => {
  const { rows } = await query(
    `SELECT sl.id, sl.ingredient_id, sl.price, sl.purchased,
            i.name, i.store_id, s.name AS store_name
       FROM shopping_list sl
       JOIN ingredients i ON i.id = sl.ingredient_id
       LEFT JOIN stores s ON s.id = i.store_id
      WHERE sl.purchased = FALSE
      ORDER BY s.name NULLS LAST, i.name`,
  )
  const byStore = new Map()
  let grandTotal = 0
  for (const item of rows) {
    const key = item.store_id == null ? '__no_store' : item.store_id
    if (!byStore.has(key)) {
      byStore.set(key, {
        store:
          item.store_id == null
            ? { id: null, name: 'No store' }
            : { id: item.store_id, name: item.store_name },
        items: [],
        total: 0,
      })
    }
    const group = byStore.get(key)
    const priceNum = parseFloat(item.price) || 0
    group.items.push({
      ingredient_id: item.ingredient_id,
      name: item.name,
      store_id: item.store_id,
      store_name: item.store_name,
      price: priceNum,
      purchased: item.purchased,
    })
    group.total += priceNum
    grandTotal += priceNum
  }
  return {
    by_store: [...byStore.values()].map((g) => ({
      ...g,
      total: Math.round(g.total * 100) / 100,
    })),
    grand_total: Math.round(grandTotal * 100) / 100,
  }
}

// --- Dashboard composer -------------------------------------------------

const composeDashboard = async (app) => {
  const [foods, prepRows, settings, shopping, stores, ingredients] = await Promise.all([
    getAllFoods(),
    query(
      `SELECT pi.food_id, pi.boxes_remaining, pi.date_prepared
         FROM prep_inventory pi
        WHERE pi.boxes_remaining > 0
        ORDER BY pi.date_prepared DESC NULLS LAST`,
    ),
    refreshSettingsLocal(app),
    getShopping(),
    query('SELECT id, name FROM stores ORDER BY name'),
    query(
      `SELECT i.id, i.name, i.store_id, s.name AS store_name,
              i.package_price, i.package_size, i.servings_per_package, i.have
         FROM ingredients i
         LEFT JOIN stores s ON s.id = i.store_id
         ORDER BY i.name`,
    ),
  ])

  // Build prepped list (with full Food shape inside).
  const prepped = await Promise.all(
    prepRows.rows.map(async (pi) => {
      const { rows: foodRow } = await query('SELECT * FROM foods WHERE id = $1', [pi.food_id])
      if (foodRow.length === 0) return null
      const food = await buildFood(foodRow[0])
      return {
        food,
        boxes_remaining: pi.boxes_remaining,
        date_prepared: pi.date_prepared,
      }
    }),
  )

  const [week, month] = await Promise.all([getWeekStats(), getMonthStats()])

  const fullCurrent = prepped
    .filter((p) => p && p.food.food_type === 'full')
    .reduce((s, p) => s + p.boxes_remaining, 0)
  const snackCurrent = prepped
    .filter((p) => p && p.food.food_type === 'snack')
    .reduce((s, p) => s + p.boxes_remaining, 0)

  return {
    what_can_i_make: foods.filter((f) => f.status === 'ready'),
    foods,
    prepped: prepped.filter(Boolean),
    prep_targets: {
      full_target: parseInt(settings.full_prep_target, 10) || 0,
      snack_target: parseInt(settings.snack_prep_target, 10) || 0,
      full_current: fullCurrent,
      snack_current: snackCurrent,
    },
    shopping,
    stats: { week, month },
    stores: stores.rows,
    ingredients: ingredients.rows.map((row) => ({
      id: row.id,
      name: row.name,
      store_id: row.store_id,
      store_name: row.store_name,
      package_price:
        row.package_price == null ? null : parseFloat(row.package_price),
      package_size: row.package_size,
      servings_per_package:
        row.servings_per_package == null
          ? null
          : parseFloat(row.servings_per_package),
      per_meal_cost: perMealCost(row),
      have: row.have,
    })),
  }
}

// Helper that just returns the cached settings (or fetches if not yet loaded).
const refreshSettingsLocal = async (app) => {
  if (!app.locals.settings) {
    app.locals.settings = await getSettings()
  }
  return app.locals.settings
}

module.exports = {
  computeStatus,
  buildFood,
  buildIngredient,
  getAllFoods,
  getSettings,
  refreshSettings,
  getWeekStats,
  getMonthStats,
  getShopping,
  composeDashboard,
}
