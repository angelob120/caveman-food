# Caveman Food — Frontend Component Contract

Single HTML page at `frontend/index.html` with these exact DOM hooks. All JS agents must use these selectors. The HTML agent must produce matching markup.

## Section order (top to bottom)
1. `#cf-header` — title + `#cf-admin-btn` (lock icon) + `#cf-admin-badge` (hidden by default)
2. `#cf-what-can-i-make` — `<h2>WHAT CAN I MAKE RIGHT NOW?</h2>` + `<div id="cf-wcm-list" class="card-grid">`
3. `#cf-idk` — `<button id="cf-idk-btn">I DON'T KNOW WHAT TO EAT</button>`
4. `#cf-filters` — `<div class="filter-bar">` with `<button class="filter-pill" data-filter="full">🍗 Full</button>` etc.
5. `#cf-foods` — `<h2>EAT SOMETHING</h2>` + `<div id="cf-food-grid" class="card-grid">`
6. `#cf-prepped` — `<h2>PREPPED FOOD</h2>` + targets `<div id="cf-prep-targets"></div>` + list `<div id="cf-prep-list"></div>`
7. `#cf-shopping` — `<h2>SHOPPING</h2>` + `<div id="cf-shop-list"></div>` + `<button id="cf-shop-bought">BOUGHT EVERYTHING</button>`
8. `#cf-stats` — `<h2>FOOD THIS WEEK</h2>` + `<div id="cf-week-stats"></div>` + `<h2>FOOD THIS MONTH</h2>` + `<div id="cf-month-stats"></div>`
9. `#cf-ingredients` — `<h2>INGREDIENTS</h2>` + `<div id="cf-ingredient-list"></div>`
10. `#cf-rules` — static block from `docs/RULES.md`
11. `#cf-admin-panel` — collapsed by default; only rendered when `localStorage.cf_admin === 'true'`

## Card markup contract
```html
<article class="food-card" data-id="<id>" data-status="<ready|missing|need_shop>" data-type="<food_type>">
  <div class="food-card-top">
    <span class="food-emoji">🌮</span>
    <h3 class="food-name">Chicken Quesadilla</h3>
    <span class="status status-ready">🟢 READY</span>
  </div>
  <div class="food-meta">~$4.50 · 10 min · Walmart</div>
  <ul class="ingredients-compact">
    <li>Chicken</li><li>Cheese</li><li>Tortilla</li>
  </ul>
  <div class="food-actions">
    <button data-action="make">MAKE THIS</button>
    <button data-action="add-shopping">ADD TO SHOPPING</button>
  </div>
</article>
```
Status class names: `status-ready`, `status-missing`, `status-need-shop`.

## Filter pill set
Each pill has `data-filter="<key>"`:
- `full`, `quick`, `snack`, `prepped`, `cheap`, `fast`
Multi-select toggle. When active, has `.active` class. Filter logic is AND across active pills.

## Detail modal (`#cf-detail-modal`)
Triggered by clicking a `.food-card`. Structure:
```html
<div id="cf-detail-modal" class="modal hidden">
  <div class="modal-content">
    <button class="modal-close" data-close>×</button>
    <div id="cf-detail-body"></div>
  </div>
</div>
```

## Random modal (`#cf-random-modal`)
Same structure as detail modal, opened by `#cf-idk-btn`. Shows ONE food.

## Admin login modal (`#cf-admin-modal`)
Contains `<input id="cf-admin-pw" type="password">` + `<button id="cf-admin-submit">UNLOCK</button>`. Default password: `123`.

## Shopping list
```html
<div class="shop-store-block" data-store-id="1">
  <h3>WALMART</h3>
  <ul class="shop-items">
    <li>Chicken breast — $12</li>
    ...
  </ul>
  <div class="shop-total">~$32</div>
</div>
<div class="shop-grand-total">TOTAL TRIP ~$53</div>
```

## Prep list
```html
<div class="prep-row" data-food-id="1">
  <span class="prep-name">Chicken + Rice</span>
  <span class="prep-count">4 boxes</span>
  <button data-action="eat-one">EAT ONE</button>
</div>
```

## Ingredient inventory row
```html
<div class="ingredient-row" data-id="1">
  <span class="ing-name">Chicken</span>
  <span class="ing-status ing-have">🟢 HAVE</span>
  <button class="ing-toggle" data-action="toggle">TOGGLE</button>  <!-- admin only -->
</div>
```

## Stats
```html
<div class="week-row"><span>Home meals eaten</span><span>11</span></div>
<div class="week-row"><span>Eating-out meals</span><span>2</span></div>
...
```

## Visual style
- Single dark theme, big readable type, no frameworks
- Mobile-first, works down to 360px
- System fonts only; emojis as icons
- CSS file at `frontend/styles.css`

## Behavior contract
- `localStorage.cf_admin === 'true'` ⇒ admin mode
- Dashboard loads once via `GET /api/dashboard`, then renders everything client-side
- Filter buttons: client-side only (no re-fetch)
- `#cf-idk-btn` → `GET /api/foods/random` → opens `#cf-random-modal`
- `.food-card` click → opens `#cf-detail-modal` with food detail
- `[data-action="make"]` (in card or modal) → `POST /api/foods/:id/eat { source: 'home' }`
- `[data-action="add-shopping"]` → `POST /api/shopping/from-food/:foodId`
- `#cf-shop-bought` → `POST /api/shopping/bought`
- `[data-action="eat-one"]` → `POST /api/foods/:id/eat { source: 'prepped' }`
- `.ing-toggle` → `PATCH /api/ingredients/:id { have: <bool> }`

## JS file layout (own by separate JS agents)
- `frontend/js/api.js` — pure fetch wrappers, exports `api.getDashboard()`, `api.randomFood()`, etc.
- `frontend/js/render.js` — pure render functions: `renderWhatCanIMake(foods)`, `renderFoodGrid(foods, filters)`, `renderPrepped(...)`, `renderShopping(...)`, `renderStats(...)`, `renderIngredients(...)`. Takes a root element and data, no event listeners.
- `frontend/js/modals.js` — wires up `#cf-detail-modal`, `#cf-random-modal`, `#cf-admin-modal`. Exports `openDetail(food)`, `openRandom()`, `openAdminLogin()`.
- `frontend/js/admin.js` — admin panel: add food form, add ingredient form, add store form, edit targets, change password. Reads `localStorage.cf_admin` to gate UI.
- `frontend/js/app.js` — entry point. Loads dashboard, calls render functions, wires up filter pills + global click delegation. Stays small.
