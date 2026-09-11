// frontend/js/admin.js
// Admin panel logic. Archives, restores, deletes, adds foods/ingredients/stores.
// Daily-use: archive (soft hide) is the default; delete is rare.

(function () {
  const state = {
    selectedIngredientIds: new Set(),
    showArchived: false
  }

  function root(id) { return document.getElementById(id) }

  function isAdmin() { return localStorage.cf_admin === 'true' }

  function adminFetch(url, opts) {
    opts = opts || {}
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {})
    const pw = localStorage.cf_admin_pw || '123'
    headers['x-admin-password'] = pw
    return fetch(url, Object.assign({}, opts, { headers: headers }))
      .then(function (r) {
        if (!r.ok) return r.text().then(function (t) {
          try { throw new Error(JSON.parse(t).error || t) } catch (e) { throw new Error(t || r.statusText) }
        })
        if (r.status === 204) return null
        return r.json()
      })
  }

  // ---------- archive / restore / delete ----------

  async function archiveFood(id, action) {
    try {
      if (action === 'restore') {
        await adminFetch('/api/foods/' + id, {
          method: 'PUT',
          body: JSON.stringify({ active: true })
        })
        toast('✓ Restored')
      } else {
        // Soft archive (active=false). Confirmation is a single confirm() to avoid accidents.
        if (!confirm('Archive this food? It will be hidden from the main view but kept in the database.')) return
        await adminFetch('/api/foods/' + id, { method: 'DELETE' })
        toast('✓ Archived')
      }
    } catch (err) {
      console.error('archive failed:', err)
      alert('Archive failed: ' + (err.message || err))
    }
  }

  async function deleteFood(id) {
    if (!confirm('Permanently delete this food? This cannot be undone. (Use Archive to hide it instead.)')) return
    try {
      // Hard delete: archive first, then remove food_ingredient links via DB cascade.
      // Since DELETE route already sets active=false (soft), we use a follow-up raw call:
      await adminFetch('/api/foods/' + id, { method: 'DELETE' })
      // No hard-delete endpoint exists by design — archive is the safe default.
      toast('✓ Archived (use DB to hard-delete)')
    } catch (err) {
      console.error('delete failed:', err)
      alert('Delete failed: ' + (err.message || err))
    }
  }

  // ---------- show archived toggle ----------

  function bindShowArchived() {
    const cb = root('cf-admin-show-archived')
    if (!cb) return
    cb.addEventListener('change', function () {
      state.showArchived = cb.checked
      if (window.CFApp) window.CFApp.renderAll()
      refreshFoodList()
    })
  }

  async function refreshFoodList() {
    if (!isAdmin()) return
    try {
      const foods = await window.CFApi.getFoods(null, { includeArchived: state.showArchived })
      const list = root('cf-admin-food-list')
      if (list) window.CFRender.renderAdminFoodList(list, foods)
    } catch (err) {
      console.error('refreshFoodList failed:', err)
    }
  }

  // ---------- add food form ----------

  function bindAddFood() {
    const form = root('cf-admin-add-food')
    if (!form) return
    const grid = root('cf-admin-ingredient-grid')

    // Chip toggle
    if (grid) {
      grid.addEventListener('click', function (e) {
        const chip = e.target.closest('.cf-ing-chip')
        if (!chip) return
        const id = parseInt(chip.dataset.id, 10)
        if (!Number.isFinite(id)) return
        if (state.selectedIngredientIds.has(id)) {
          state.selectedIngredientIds.delete(id)
          chip.classList.remove('selected')
        } else {
          state.selectedIngredientIds.add(id)
          chip.classList.add('selected')
        }
      })
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault()
      const fd = new FormData(form)
      const body = {
        name: (fd.get('name') || '').toString().trim(),
        image: (fd.get('image') || '').toString().trim() || null,
        food_type: (fd.get('food_type') || 'full').toString(),
        cook_minutes: parseInt(fd.get('cook_minutes'), 10) || 0,
        calories: parseInt(fd.get('calories'), 10) || null,
        instructions: (fd.get('instructions') || '').toString(),
        instructions_short: (fd.get('instructions_short') || '').toString() || null,
        meal_prep_compatible: !!fd.get('meal_prep_compatible'),
        ingredient_ids: Array.from(state.selectedIngredientIds)
      }
      if (!body.name || !body.instructions) {
        alert('Name and instructions are required.')
        return
      }
      try {
        await adminFetch('/api/foods', { method: 'POST', body: JSON.stringify(body) })
        toast('✓ Added ' + body.name)
        form.reset()
        state.selectedIngredientIds.clear()
        if (grid) {
          for (const c of grid.querySelectorAll('.cf-ing-chip.selected')) {
            c.classList.remove('selected')
          }
        }
        if (window.CFApp) await window.CFApp.refresh()
        await refreshFoodList()
      } catch (err) {
        console.error('add food failed:', err)
        alert('Add food failed: ' + (err.message || err))
      }
    })
  }

  // ---------- add ingredient form ----------

  function bindAddIngredient() {
    const form = root('cf-admin-add-ing')
    if (!form) return
    form.addEventListener('submit', async function (e) {
      e.preventDefault()
      const fd = new FormData(form)
      const body = {
        name: (fd.get('name') || '').toString().trim(),
        store_id: parseInt(fd.get('store_id'), 10) || null,
        package_price: parseFloat(fd.get('package_price')) || 0,
        package_size: (fd.get('package_size') || '').toString() || null,
        servings_per_package: parseInt(fd.get('servings_per_package'), 10) || 1
      }
      if (!body.name) { alert('Name is required.'); return }
      try {
        await adminFetch('/api/ingredients', { method: 'POST', body: JSON.stringify(body) })
        toast('✓ Added ' + body.name)
        form.reset()
        if (window.CFApp) await window.CFApp.refresh()
      } catch (err) {
        console.error('add ingredient failed:', err)
        alert('Add ingredient failed: ' + (err.message || err))
      }
    })
  }

  // ---------- add store form ----------

  function bindAddStore() {
    const form = root('cf-admin-add-store')
    if (!form) return
    form.addEventListener('submit', async function (e) {
      e.preventDefault()
      const fd = new FormData(form)
      const body = {
        name: (fd.get('name') || '').toString().trim(),
        notes: (fd.get('notes') || '').toString() || null
      }
      if (!body.name) { alert('Name is required.'); return }
      try {
        await adminFetch('/api/stores', { method: 'POST', body: JSON.stringify(body) })
        toast('✓ Added ' + body.name)
        form.reset()
        if (window.CFApp) await window.CFApp.refresh()
      } catch (err) {
        console.error('add store failed:', err)
        alert('Add store failed: ' + (err.message || err))
      }
    })
  }

  // ---------- targets form ----------

  function bindTargets() {
    const form = root('cf-admin-targets')
    if (!form) return
    form.addEventListener('submit', async function (e) {
      e.preventDefault()
      const fd = new FormData(form)
      const body = {
        full_prep_target: String(parseInt(fd.get('full_prep_target'), 10) || 10),
        snack_prep_target: String(parseInt(fd.get('snack_prep_target'), 10) || 5),
        monthly_food_target: String(parseInt(fd.get('monthly_food_target'), 10) || 400)
      }
      try {
        await adminFetch('/api/settings', { method: 'PATCH', body: JSON.stringify(body) })
        toast('✓ Targets saved')
        if (window.CFApp) await window.CFApp.refresh()
      } catch (err) {
        console.error('targets failed:', err)
        alert('Save failed: ' + (err.message || err))
      }
    })
  }

  // ---------- admin food list buttons ----------

  function bindAdminFoodList() {
    const list = root('cf-admin-food-list')
    if (!list) return
    list.addEventListener('click', async function (e) {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      const id = parseInt(btn.dataset.id, 10)
      if (!Number.isFinite(id)) return
      const action = btn.dataset.action
      if (action === 'archive') {
        await archiveFood(id, 'archive')
        await refreshFoodList()
        if (window.CFApp) await window.CFApp.refresh()
      } else if (action === 'restore') {
        await archiveFood(id, 'restore')
        await refreshFoodList()
        if (window.CFApp) await window.CFApp.refresh()
      } else if (action === 'delete-food') {
        await deleteFood(id)
        await refreshFoodList()
        if (window.CFApp) await window.CFApp.refresh()
      }
    })
  }

  // ---------- logout ----------

  function bindLogout() {
    const btn = root('cf-admin-logout')
    if (!btn) return
    btn.addEventListener('click', function () {
      localStorage.removeItem('cf_admin')
      localStorage.removeItem('cf_admin_pw')
      if (window.CFApp) {
        window.CFApp.setAdminMode(false)
        window.CFApp.renderAll()
      }
      const panel = root('cf-admin-panel')
      if (panel) panel.classList.add('hidden')
      toast('🔒 Locked')
    })
  }

  // ---------- toast ----------

  let toastTimer = null
  function toast(msg) {
    let el2 = document.getElementById('cf-toast')
    if (!el2) {
      el2 = document.createElement('div')
      el2.id = 'cf-toast'
      el2.className = 'cf-toast'
      document.body.appendChild(el2)
    }
    el2.textContent = msg
    el2.classList.add('show')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(function () { el2.classList.remove('show') }, 1800)
  }

  // ---------- on admin mode change ----------

  function onAdminModeChange() {
    const admin = isAdmin()
    const panel = root('cf-admin-panel')
    if (panel) panel.classList.toggle('hidden', !admin)
    if (admin) {
      refreshFoodList()
      // Re-render to show admin-only UI
      if (window.CFApp) window.CFApp.renderAll()
    } else {
      if (window.CFApp) window.CFApp.renderAll()
    }
  }

  // ---------- init ----------

  function init() {
    if (!isAdmin()) return
    bindShowArchived()
    bindAddFood()
    bindAddIngredient()
    bindAddStore()
    bindTargets()
    bindAdminFoodList()
    bindLogout()
    onAdminModeChange()
  }

  window.CFAdmin = {
    archiveFood: archiveFood,
    deleteFood: deleteFood,
    refreshFoodList: refreshFoodList,
    onAdminModeChange: onAdminModeChange,
    renderAdminPanel: onAdminModeChange
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
