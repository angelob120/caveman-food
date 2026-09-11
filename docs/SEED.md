# Caveman Food — Frontend Component Contract

Single HTML page (`frontend/index.html`) with sections in this exact order:

1. **Header** — `CAVEMAN FOOD` title + admin lock button + (admin) ADMIN badge.
2. **WHAT CAN I MAKE RIGHT NOW?** — cards of foods where all ingredients are HAVE.
3. **I DON'T KNOW WHAT TO EAT** — single big button → calls `/api/foods/random`, shows modal with one food + MAKE IT button.
4. **FILTERS** — pill buttons: 🍗 Full · 🥪 Quick · 🍓 Snack · 🧊 Prepped · 💰 Cheap · ⚡ Fast. Multi-select toggle.
5. **FOOD CARDS** — grid. Card shows image, name, status pill, cost, time, store, ingredients (compact), buttons (MAKE THIS / ADD TO SHOPPING). Tap card → detail modal.
6. **PREPPED FOOD** — counts (X/10 full, Y/5 snack) + list with "EAT ONE" buttons.
7. **SHOPPING LIST** — grouped by store + grand total. BOUGHT EVERYTHING button.
8. **FOOD THIS WEEK** — home meals, eating out, costs. **FOOD THIS MONTH** below it.
9. **INGREDIENTS** — list with HAVE/OUT toggle (admin only).
10. **FOOD RULES** — static text block from `docs/RULES.md`.
11. **ADMIN** — collapsible admin panel: add food, edit food, delete food, add ingredient, add store, edit targets, change password.

## Detail modal
Triggered by tapping a card. Shows: name, image, cost, store, time, makes, calories, ingredients with checkmarks, instructions as big step list, ADD TO SHOPPING + EAT buttons.

## Status pills
- 🟢 READY — all ingredients.have = true
- 🟡 MISSING — 1–2 ingredients have=false
- 🔴 NEED TO SHOP — >2 ingredients have=false OR all ingredients have=false

## Card example markup
```html
<article class="food-card" data-status="ready" data-id="1">
  <div class="food-card-top">
    <span class="food-emoji">🌮</span>
    <h3>Chicken Quesadilla</h3>
    <span class="status ready">🟢 READY</span>
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

## Required behavior
- Admin mode = localStorage key `cf_admin` set to true after password entry. All admin-only UI gated by checking `localStorage.cf_admin === 'true'`.
- Default view loads `/api/dashboard` once, renders everything client-side.
- Filter buttons toggle client-side; no re-fetch.
- "I DON'T KNOW" calls `/api/foods/random` and opens a centered modal with the result. MAKE IT button → POST `/api/foods/:id/eat`.
- BOUGHT EVERYTHING → POST `/api/shopping/bought` then re-fetch dashboard.
- No build step. Plain HTML + one CSS file + one JS module. Total < 200KB.

## Visual style
- Single dark theme, big readable type, no frameworks.
- Mobile-first, works down to 360px.
- Use system fonts; no icon library — emojis only.
