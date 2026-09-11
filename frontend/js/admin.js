// frontend/js/admin.js
// Admin panel: CRUD forms for foods, ingredients, stores, settings.
// Uses a local adminFetch helper (does not depend on CFApi having CRUD methods).

(function () {
  'use strict'

  // ---------- admin fetch helper ----------
  // Mirrors CFApi.adminHeader() but reads the pw from localStorage so we don't
  // depend on Agent 4's exact API surface. Throws Error with status + body on non-2xx.
  const adminFetch = async (url, opts = {}) => {
    const headers = Object.assign(
      {
        'Content-Type': 'application/json',
        'x-admin-password': localStorage.getItem('cf_admin_pw') || '123'
      },
      opts.headers || {}
    )
    const res = await fetch(url, Object.assign({}, opts, { headers }))
    if (!res.ok) {
      let body = ''
      try {
        body = await res.text()
      } catch (e) { /* ignore */ }
      throw new Error('HTTP ' + res.status + (body ? ': ' + body : ''))
    }
    if (res.status === 204) return null
    try {
      return await res.json()
    } catch (e) {
      return null
    }
  }

  // CRUD wrappers — kept local so the admin panel works regardless of CFApi
  const createFood = (body) =>
    adminFetch('/api/foods', { method: 'POST', body: JSON.stringify(body) })
  const updateFood = (id, body) =>
    adminFetch('/api/foods/' + id, { method: 'PUT', body: JSON.stringify(body) })
  const deleteFood = (id) =>
    adminFetch('/api/foods/' + id, { method: 'DELETE' })
  const createIngredient = (body) =>
    adminFetch('/api/ingredients', { method: 'POST', body: JSON.stringify(body) })
  const createStore = (body) =>
    adminFetch('/api/stores', { method: 'POST', body: JSON.stringify(body) })
  const updateTargets = (body) =>
    adminFetch('/api/settings', { method: 'PATCH', body: JSON.stringify(body) })

  // ---------- helpers ----------
  const escape = (s) => {
    if (s == null) return ''
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]))
  }

  const refresh = () => {
    if (window.CFApp && typeof window.CFApp.refresh === 'function') {
      window.CFApp.refresh()
    }
  }

  const findEl = (id) => document.getElementById(id)

  const setMsg = (id, text, kind) => {
    const el = findEl(id)
    if (!el) return
    el.textContent = text || ''
    el.className = 'form-msg' + (kind ? ' ' + kind : '')
  }

  const isAdmin = () => localStorage.getItem('cf_admin') === 'true'

  // ---------- render admin panel ----------
  const renderAdminPanel = (data) => {
    const panel = findEl('cf-admin-panel')
    if (!panel) return

    // gate: only render when admin
    if (!isAdmin()) {
      panel.innerHTML = ''
      return
    }

    const ingredients = (data && data.ingredients) || []
    const stores = (data && data.stores) || []
    const foods = (data && data.foods) || []
    const targets = (data && data.prep_targets) || {}

    panel.innerHTML = `
      <h2 class="admin-title">⚙️ ADMIN PANEL</h2>

      <section class="admin-section">
        <h3>Add Food</h3>
        <form id="cf-admin-add-food" class="admin-form">
          <div class="form-row">
            <label>Name <input type="text" name="name" required></label>
            <label>Image (emoji) <input type="text" name="image" maxlength="4" placeholder="🍝"></label>
          </div>
          <div class="form-row">
            <label>Type
              <select name="food_type">
                <option value="full">full</option>
                <option value="quick">quick</option>
                <option value="snack">snack</option>
                <option value="prepped">prepped</option>
              </select>
            </label>
            <label>Cook minutes <input type="number" name="cook_minutes" min="0" value="10"></label>
            <label>Calories <input type="number" name="calories" min="0"></label>
          </div>
          <label>Instructions (one step per line)
            <textarea name="instructions" rows="4" required></textarea>
          </label>
          <label>Short instructions (optional)
            <textarea name="instructions_short" rows="2"></textarea>
          </label>
          <label class="checkbox">
            <input type="checkbox" name="meal_prep_compatible"> Meal prep compatible
          </label>
          <label>Ingredients (cmd/ctrl + click to multi-select)
            <select name="ingredient_ids" multiple size="6">
              ${
                ingredients.length
                  ? ingredients
                      .map(
                        (i) =>
                          `<option value="${i.id}">${escape(i.name)} — ${escape(
                            i.store_name || '—'
                          )}</option>`
                      )
                      .join('')
                  : '<option disabled>No ingredients yet</option>'
              }
            </select>
          </label>
          <button type="submit" class="btn btn-primary">+ ADD FOOD</button>
          <div class="form-msg" id="cf-msg-add-food"></div>
        </form>
      </section>

      <section class="admin-section">
        <h3>Add Ingredient</h3>
        <form id="cf-admin-add-ing" class="admin-form">
          <div class="form-row">
            <label>Name <input type="text" name="name" required></label>
            <label>Store
              <select name="store_id" required>
                <option value="">— pick a store —</option>
                ${stores
                  .map((s) => `<option value="${s.id}">${escape(s.name)}</option>`)
                  .join('')}
              </select>
            </label>
          </div>
          <div class="form-row">
            <label>Package price ($) <input type="number" name="package_price" step="0.01" min="0" required></label>
            <label>Package size <input type="text" name="package_size" placeholder="2 lb"></label>
            <label>Servings per package <input type="number" name="servings_per_package" step="0.5" min="0" required></label>
          </div>
          <button type="submit" class="btn btn-primary">+ ADD INGREDIENT</button>
          <div class="form-msg" id="cf-msg-add-ing"></div>
        </form>
      </section>

      <section class="admin-section">
        <h3>Add Store</h3>
        <form id="cf-admin-add-store" class="admin-form">
          <div class="form-row">
            <label>Name <input type="text" name="name" required></label>
            <label>Notes (optional) <input type="text" name="notes"></label>
          </div>
          <button type="submit" class="btn btn-primary">+ ADD STORE</button>
          <div class="form-msg" id="cf-msg-add-store"></div>
        </form>
      </section>

      <section class="admin-section">
        <h3>Edit Targets &amp; Password</h3>
        <form id="cf-admin-targets" class="admin-form">
          <div class="form-row">
            <label>Full prep target
              <input type="number" name="full_prep_target" min="0" value="${escape(
                targets.full_target != null ? targets.full_target : ''
              )}">
            </label>
            <label>Snack prep target
              <input type="number" name="snack_prep_target" min="0" value="${escape(
                targets.snack_target != null ? targets.snack_target : ''
              )}">
            </label>
            <label>Monthly food target ($)
              <input type="number" name="monthly_food_target" min="0">
            </label>
          </div>
          <label>Admin password
            <input type="password" name="admin_password" placeholder="leave blank to keep current">
          </label>
          <button type="submit" class="btn btn-primary">💾 SAVE</button>
          <div class="form-msg" id="cf-msg-targets"></div>
        </form>
      </section>

      <section class="admin-section">
        <h3>Food List (${foods.length})</h3>
        <div id="cf-admin-food-list" class="admin-food-list">
          ${
            foods.length
              ? foods.map((f) => renderFoodRow(f)).join('')
              : '<p class="empty">No foods yet.</p>'
          }
        </div>
      </section>

      <div class="admin-footer">
        <button id="cf-admin-logout" class="btn btn-danger">🚪 LOG OUT OF ADMIN</button>
      </div>
    `

    wireForms()
  }

  const renderFoodRow = (food) => {
    const storeName = (food.primary_store && food.primary_store.name) || '—'
    return `
      <div class="admin-food-row" data-food-id="${food.id}">
        <div class="row-view">
          <span class="row-emoji">${escape(food.image || '🍽️')}</span>
          <span class="row-name">${escape(food.name || '')}</span>
          <span class="row-type">${escape(food.food_type || '')}</span>
          <span class="row-meta">${food.cook_minutes || 0}m · ${escape(storeName)}</span>
          <span class="row-cost">${food.cost_per_meal != null ? '$' + Number(food.cost_per_meal).toFixed(2) : ''}</span>
          <button class="btn btn-small" data-action="edit-food" data-id="${food.id}">EDIT</button>
          <button class="btn btn-small btn-danger" data-action="delete-food" data-id="${food.id}">DELETE</button>
        </div>
        <div class="row-edit hidden"></div>
      </div>
    `
  }

  // ---------- wire forms ----------
  const wireForms = () => {
    wireAddFood()
    wireAddIngredient()
    wireAddStore()
    wireTargets()
    wireLogout()
    wireFoodList()
  }

  const wireAddFood = () => {
    const form = findEl('cf-admin-add-food')
    if (!form) return
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(form)
      const ingredientIds = fd
        .getAll('ingredient_ids')
        .map((v) => Number(v))
        .filter((n) => !isNaN(n) && n > 0)
      const body = {
        name: String(fd.get('name') || '').trim(),
        image: String(fd.get('image') || '').trim() || '🍽️',
        food_type: String(fd.get('food_type') || 'quick'),
        cook_minutes: Number(fd.get('cook_minutes')) || 0,
        calories: fd.get('calories') ? Number(fd.get('calories')) : null,
        instructions: String(fd.get('instructions') || ''),
        instructions_short: fd.get('instructions_short')
          ? String(fd.get('instructions_short'))
          : null,
        meal_prep_compatible: !!fd.get('meal_prep_compatible'),
        ingredient_ids: ingredientIds
      }
      if (!body.name || !body.instructions) {
        setMsg('cf-msg-add-food', 'Name and instructions are required.', 'err')
        return
      }
      setMsg('cf-msg-add-food', 'Saving...', 'pending')
      try {
        await createFood(body)
        setMsg('cf-msg-add-food', '✅ Added!', 'ok')
        form.reset()
        refresh()
      } catch (err) {
        setMsg('cf-msg-add-food', '❌ ' + (err.message || err), 'err')
      }
    })
  }

  const wireAddIngredient = () => {
    const form = findEl('cf-admin-add-ing')
    if (!form) return
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(form)
      const storeId = Number(fd.get('store_id'))
      const body = {
        name: String(fd.get('name') || '').trim(),
        store_id: isNaN(storeId) || storeId <= 0 ? null : storeId,
        package_price: Number(fd.get('package_price')),
        package_size: fd.get('package_size')
          ? String(fd.get('package_size'))
          : null,
        servings_per_package: Number(fd.get('servings_per_package'))
      }
      if (!body.name || isNaN(body.package_price) || isNaN(body.servings_per_package)) {
        setMsg(
          'cf-msg-add-ing',
          'Name, price, and servings are required.',
          'err'
        )
        return
      }
      setMsg('cf-msg-add-ing', 'Saving...', 'pending')
      try {
        await createIngredient(body)
        setMsg('cf-msg-add-ing', '✅ Added!', 'ok')
        form.reset()
        refresh()
      } catch (err) {
        setMsg('cf-msg-add-ing', '❌ ' + (err.message || err), 'err')
      }
    })
  }

  const wireAddStore = () => {
    const form = findEl('cf-admin-add-store')
    if (!form) return
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(form)
      const body = {
        name: String(fd.get('name') || '').trim(),
        notes: fd.get('notes') ? String(fd.get('notes')) : null
      }
      if (!body.name) {
        setMsg('cf-msg-add-store', 'Name is required.', 'err')
        return
      }
      setMsg('cf-msg-add-store', 'Saving...', 'pending')
      try {
        await createStore(body)
        setMsg('cf-msg-add-store', '✅ Added!', 'ok')
        form.reset()
        refresh()
      } catch (err) {
        setMsg('cf-msg-add-store', '❌ ' + (err.message || err), 'err')
      }
    })
  }

  const wireTargets = () => {
    const form = findEl('cf-admin-targets')
    if (!form) return
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(form)
      const body = {}
      const ft = fd.get('full_prep_target')
      const st = fd.get('snack_prep_target')
      const mt = fd.get('monthly_food_target')
      const pw = fd.get('admin_password')
      if (ft !== null && ft !== '') body.full_prep_target = Number(ft)
      if (st !== null && st !== '') body.snack_prep_target = Number(st)
      if (mt !== null && mt !== '') body.monthly_food_target = Number(mt)
      if (pw) body.admin_password = String(pw)
      setMsg('cf-msg-targets', 'Saving...', 'pending')
      try {
        await updateTargets(body)
        if (pw) localStorage.setItem('cf_admin_pw', String(pw))
        setMsg('cf-msg-targets', '✅ Saved!', 'ok')
        refresh()
      } catch (err) {
        setMsg('cf-msg-targets', '❌ ' + (err.message || err), 'err')
      }
    })
  }

  const wireLogout = () => {
    const btn = findEl('cf-admin-logout')
    if (!btn) return
    btn.addEventListener('click', () => {
      localStorage.removeItem('cf_admin')
      // keep cf_admin_pw so re-login is faster? actually clear it for full logout
      localStorage.removeItem('cf_admin_pw')
      onAdminModeChange()
      refresh()
    })
  }

  // Food list: edit (inline) / delete buttons
  const wireFoodList = () => {
    const list = findEl('cf-admin-food-list')
    if (!list) return

    list.addEventListener('click', async (e) => {
      const row = e.target.closest('.admin-food-row')
      if (!row) return
      const id = Number(row.dataset.foodId)
      if (!id) return

      if (e.target.closest('[data-action="delete-food"]')) {
        if (!confirm('Delete this food?')) return
        try {
          await deleteFood(id)
          refresh()
        } catch (err) {
          alert('Delete failed: ' + (err.message || err))
        }
        return
      }

      if (e.target.closest('[data-action="edit-food"]')) {
        openInlineEdit(row, id)
        return
      }

      if (e.target.closest('[data-action="cancel-edit"]')) {
        closeInlineEdit(row)
        return
      }

      if (e.target.closest('[data-action="save-food"]')) {
        await saveInlineEdit(row, id)
      }
    })
  }

  const openInlineEdit = (row, id) => {
    const foods = (window.CFApp && window.CFApp.state && window.CFApp.state.foods) || []
    const food = foods.find((f) => f.id === id)
    if (!food) return
    const view = row.querySelector('.row-view')
    const edit = row.querySelector('.row-edit')
    if (!edit) return
    if (view) view.classList.add('hidden')
    edit.classList.remove('hidden')
    edit.innerHTML = `
      <form class="inline-edit-form">
        <div class="form-row">
          <label>Name <input type="text" name="name" value="${escape(food.name || '')}" required></label>
          <label>Emoji <input type="text" name="image" value="${escape(food.image || '')}" maxlength="4"></label>
          <label>Type
            <select name="food_type">
              <option value="full" ${food.food_type === 'full' ? 'selected' : ''}>full</option>
              <option value="quick" ${food.food_type === 'quick' ? 'selected' : ''}>quick</option>
              <option value="snack" ${food.food_type === 'snack' ? 'selected' : ''}>snack</option>
              <option value="prepped" ${food.food_type === 'prepped' ? 'selected' : ''}>prepped</option>
            </select>
          </label>
        </div>
        <div class="form-row">
          <label>Cook min <input type="number" name="cook_minutes" min="0" value="${food.cook_minutes || 0}"></label>
          <label>Calories <input type="number" name="calories" min="0" value="${food.calories || ''}"></label>
        </div>
        <label>Instructions
          <textarea name="instructions" rows="3">${escape(food.instructions || '')}</textarea>
        </label>
        <div class="inline-actions">
          <button type="button" class="btn btn-small btn-primary" data-action="save-food" data-id="${id}">💾 SAVE</button>
          <button type="button" class="btn btn-small" data-action="cancel-edit" data-id="${id}">CANCEL</button>
        </div>
      </form>
    `
  }

  const closeInlineEdit = (row) => {
    const view = row.querySelector('.row-view')
    const edit = row.querySelector('.row-edit')
    if (view) view.classList.remove('hidden')
    if (edit) {
      edit.classList.add('hidden')
      edit.innerHTML = ''
    }
  }

  const saveInlineEdit = async (row, id) => {
    const form = row.querySelector('.inline-edit-form')
    if (!form) return
    const fd = new FormData(form)
    const body = {
      name: String(fd.get('name') || '').trim(),
      image: String(fd.get('image') || '').trim() || '🍽️',
      food_type: String(fd.get('food_type') || 'quick'),
      cook_minutes: Number(fd.get('cook_minutes')) || 0,
      calories: fd.get('calories') ? Number(fd.get('calories')) : null,
      instructions: String(fd.get('instructions') || '')
    }
    try {
      await updateFood(id, body)
      refresh()
    } catch (err) {
      alert('Save failed: ' + (err.message || err))
    }
  }

  // ---------- admin mode toggle ----------
  const onAdminModeChange = () => {
    const badge = findEl('cf-admin-badge')
    const panel = findEl('cf-admin-panel')
    if (badge) {
      if (isAdmin()) badge.classList.remove('hidden')
      else badge.classList.add('hidden')
    }
    if (panel && !isAdmin()) {
      panel.innerHTML = ''
    }
  }

  // expose
  window.CFAdmin = { renderAdminPanel, onAdminModeChange }
})()
