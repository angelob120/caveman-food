# Caveman Food — API Contract (V1)

Base URL: `https://<railway-domain>/api` (and `http://localhost:3000/api` for dev)
All responses are JSON. Errors return `{ "error": "<msg>" }` with appropriate HTTP status.

Auth: admin endpoints require header `x-admin-password: 123` (configurable via `ADMIN_PASSWORD` env). Public endpoints are read-only and never mutate.

## Conventions
- Money values: number in USD (no string formatting)
- Boolean flags: real booleans
- `cost_per_meal` is computed server-side: `Σ (ingredient.package_price / ingredient.servings_per_package)` across food's ingredients.

---

## Public reads

### GET /api/dashboard
Returns everything the homepage needs in one shot.
```json
{
  "what_can_i_make": [ Food, Food, ... ],   // only foods where all ingredients are HAVE
  "foods": [ Food, Food, ... ],              // all active foods
  "prepped": [
    { "food": Food, "boxes_remaining": 4, "date_prepared": "2026-09-08" }
  ],
  "prep_targets": { "full_target": 10, "snack_target": 5, "full_current": 8, "snack_current": 4 },
  "shopping": {
    "by_store": [
      { "store": { "id": 1, "name": "Walmart" }, "items": [ShoppingItem], "total": 32 },
      ...
    ],
    "grand_total": 53
  },
  "stats": {
    "week": { "home_meals": 11, "eating_out": 2, "home_cost": 67, "out_cost": 41, "prep_boxes_left": 6 },
    "month": { "groceries": 284, "eating_out": 113, "total": 397, "previous_total": 721 }
  },
  "stores": [ { "id": 1, "name": "Walmart" }, ... ],
  "ingredients": [ Ingredient, ... ]   // for inventory display
}
```

### Food shape
```json
{
  "id": 1,
  "name": "Chicken Quesadilla",
  "image": "🌮",
  "food_type": "quick",                 // full | quick | snack | prepped
  "cook_minutes": 10,
  "calories": 900,
  "instructions_short": "Put chicken in pan.\nAdd cheese to tortilla.\nAdd chicken.\nFold.\nCook both sides.\nEat.",
  "instructions": "...",
  "meal_prep_compatible": true,
  "favorite": false,
  "active": true,
  "cost_per_meal": 4.50,                // computed
  "status": "ready",                    // ready | missing | need_shop   (computed from ingredients)
  "missing_ingredients": [],            // empty when status=ready
  "ingredients": [Ingredient, ...],
  "primary_store": { "id": 1, "name": "Walmart" }
}
```

### Ingredient shape
```json
{
  "id": 1,
  "name": "Chicken Breast",
  "store_id": 1,
  "store_name": "Walmart",
  "package_price": 12.00,
  "package_size": "2 lb",
  "servings_per_package": 4,
  "per_meal_cost": 3.00,
  "have": true
}
```

### ShoppingItem shape
```json
{
  "ingredient_id": 1,
  "name": "Chicken Breast",
  "store_id": 1,
  "store_name": "Walmart",
  "price": 12.00,
  "purchased": false
}
```

### GET /api/foods
Returns array of `Food`. Supports `?type=full|quick|snack|prepped`.

### GET /api/foods/:id
Returns one `Food` with full detail (ingredients + cost + status).

### GET /api/foods/random
Returns one `Food` from the set where `status=ready`. If none ready, returns the cheapest "missing" food. 404 if no foods at all.

### POST /api/foods/:id/eat
Logs an eating event (source=`home` or `prepped`) with cost = `cost_per_meal`, decrements prep inventory if applicable. Body: `{ "source": "home" | "prepped" }`. Returns the updated Food.

### POST /api/shopping/from-food/:foodId
Adds only the *missing* ingredients of that food to the shopping list. Returns `{ "added": [ShoppingItem, ...], "already_have": ["Tortillas","Cheese"] }`.

### POST /api/shopping/bought
Marks all unpurchased shopping items as purchased, and sets their ingredients to `have=true`. Returns updated shopping list.

### GET /api/ingredients
Returns all ingredients.

### PATCH /api/ingredients/:id   (admin)
Body: `{ "have": true|false }` — toggle HAVE / OUT. Or full update `{ "name", "store_id", "package_price", "package_size", "servings_per_package" }`.

---

## Admin (require `x-admin-password` header)

### POST /api/foods   (admin)
Body:
```json
{
  "name": "Chicken Alfredo",
  "image": "🍝",
  "food_type": "full",
  "cook_minutes": 20,
  "calories": 950,
  "instructions": "Cook pasta.\nCook chicken.\nAdd sauce.\nMix.\nEat.",
  "instructions_short": "...",
  "meal_prep_compatible": true,
  "ingredient_ids": [1, 4, 7]
}
```
Returns the created `Food`.

### PUT /api/foods/:id   (admin)
Body same as POST, partial ok.

### DELETE /api/foods/:id   (admin)
Soft delete (`active=false`). Returns 204.

### POST /api/ingredients   (admin)
Body: `{ "name", "store_id", "package_price", "package_size", "servings_per_package" }`. Returns `Ingredient`.

### DELETE /api/ingredients/:id   (admin)
Hard delete.

### POST /api/stores   (admin)
Body: `{ "name", "notes" }`. Returns `Store`.

### PATCH /api/prep/:foodId   (admin)
Body: `{ "boxes_remaining": 3, "date_prepared": "2026-09-11" }`.

### POST /api/food-log   (admin or public)
Body: `{ "food_id"?: number, "label": "Chipotle burrito", "source": "restaurant", "cost": 18.50 }`.
Used to log eating-out meals.

### GET /api/settings   (admin)
### PATCH /api/settings   (admin)
Body: `{ "admin_password"?, "full_prep_target"?, "snack_prep_target"?, "monthly_food_target"? }`

---

## Filter semantics (frontend)
- `full` → `food_type='full'`
- `quick` → `food_type='quick'`
- `snack` → `food_type='snack'`
- `prepped` → items with `prep_inventory.boxes_remaining > 0`
- `cheap` → `cost_per_meal <= 5`
- `fast` → `cook_minutes <= 15`

A food passes the active filter set if it satisfies ALL active filters (AND).
