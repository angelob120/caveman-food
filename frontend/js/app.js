// frontend/js/app.js
// Entry point. Loads dashboard, renders all sections, wires all interactions.
// Must be loaded LAST (after api.js, render.js, modals.js, admin.js).

(function () {
  'use strict'

  // ---------- module state ----------
  const state = {
    dashboard: null,
    foods: [],
    activeFilters: new Set()
  }

  // ---------- refresh ----------
  const refresh = async () => {
    if (!window.CFApi || typeof window.CFApi.getDashboard !== 'function') {
      console.error('CFApi not loaded — make sure api.js is included before app.js')
      return
    }
    try {
      const data = await window.CFApi.getDashboard()
      state.dashboard = data || null
      state.foods = (data && data.foods) || []
    } catch (err) {
      console.error('Dashboard fetch failed:', err)
      return
    }
    render()
  }

  // ---------- render all sections ----------
  const render = () => {
    const d = state.dashboard
    if (!d) return
    const R = window.CFRender || {}
    const root = (id) => document.getElementById(id)
    const admin = localStorage.getItem('cf_admin') === 'true'

    // WHAT CAN I MAKE
    if (typeof R.renderWhatCanIMake === 'function') {
      try {
        R.renderWhatCanIMake(root('cf-wcm-list'), d.what_can_i_make || [])
      } catch (e) { console.warn('renderWhatCanIMake failed:', e) }
    }

    // FOOD GRID (renderFoodGrid filters internally given the active filters + preppedList)
    if (typeof R.renderFoodGrid === 'function') {
      try {
        R.renderFoodGrid(
          root('cf-food-grid'),
          d.foods || [],
          Array.from(state.activeFilters),
          d.prepped || []
        )
      } catch (e) { console.warn('renderFoodGrid failed:', e) }
    }

    // PREPPED
    if (typeof R.renderPrepped === 'function') {
      try {
        R.renderPrepped(
          root('cf-prep-targets'),
          root('cf-prep-list'),
          d.prep_targets || {},
          d.prepped || []
        )
      } catch (e) { console.warn('renderPrepped failed:', e) }
    }

    // SHOPPING
    if (typeof R.renderShopping === 'function') {
      try {
        R.renderShopping(
          root('cf-shop-list'),
          root('cf-shop-grand'),
          d.shopping || {}
        )
      } catch (e) { console.warn('renderShopping failed:', e) }
    }

    // STATS
    if (typeof R.renderStats === 'function') {
      try {
        R.renderStats(
          root('cf-week-stats'),
          root('cf-month-stats'),
          d.stats || {}
        )
      } catch (e) { console.warn('renderStats failed:', e) }
    }

    // INGREDIENTS (Agent 4's render reads localStorage.cf_admin internally
    // to decide whether to render the toggle button — no need to pass it)
    if (typeof R.renderIngredients === 'function') {
      try {
        R.renderIngredients(root('cf-ingredient-list'), d.ingredients || [])
      } catch (e) { console.warn('renderIngredients failed:', e) }
    }

    // ADMIN PANEL
    if (window.CFAdmin && typeof window.CFAdmin.renderAdminPanel === 'function') {
      try {
        window.CFAdmin.renderAdminPanel(d)
      } catch (e) { console.warn('renderAdminPanel failed:', e) }
    }

    // Admin badge
    const badge = root('cf-admin-badge')
    if (badge) {
      if (admin) badge.classList.remove('hidden')
      else badge.classList.add('hidden')
    }
  }

  // ---------- filter logic ----------
  // CFRender.renderFoodGrid handles filtering internally given the active
  // filter set + the prepped list. app.js only owns the pill toggle state.

  // ---------- wire filter pills ----------
  const wireFilters = () => {
    const filterBar = document.getElementById('cf-filters')
    if (!filterBar) return

    filterBar.addEventListener('click', (e) => {
      const pill = e.target.closest('.filter-pill')
      if (!pill) return
      const key = pill.dataset.filter
      if (!key) return

      if (state.activeFilters.has(key)) {
        state.activeFilters.delete(key)
        pill.classList.remove('active')
      } else {
        state.activeFilters.add(key)
        pill.classList.add('active')
      }

      // Re-render only the food grid (no re-fetch)
      if (window.CFRender && typeof window.CFRender.renderFoodGrid === 'function') {
        window.CFRender.renderFoodGrid(
          document.getElementById('cf-food-grid'),
          state.foods || [],
          Array.from(state.activeFilters),
          (state.dashboard && state.dashboard.prepped) || []
        )
      }
    })
  }

  // ---------- wire global click delegation ----------
  const wireGlobalClicks = () => {
    document.addEventListener('click', async (e) => {
      // Admin login trigger
      if (e.target.closest('#cf-admin-btn')) {
        if (window.CFModals && typeof window.CFModals.openAdminLogin === 'function') {
          window.CFModals.openAdminLogin()
        }
        return
      }

      // "I DON'T KNOW" button
      if (e.target.closest('#cf-idk-btn')) {
        if (window.CFModals && typeof window.CFModals.openRandom === 'function') {
          window.CFModals.openRandom()
        }
        return
      }

      // "BOUGHT EVERYTHING" button
      if (e.target.closest('#cf-shop-bought')) {
        if (window.CFApi && typeof window.CFApi.markBought === 'function') {
          try {
            await window.CFApi.markBought()
            refresh()
          } catch (err) {
            console.error('markBought failed:', err)
            alert('Could not mark shopping list as bought: ' + (err.message || err))
          }
        }
        return
      }

      // MAKE THIS (food card OR modal button)
      const makeBtn = e.target.closest('[data-action="make"]')
      if (makeBtn) {
        if (window.CFApi && typeof window.CFApi.eatFood === 'function') {
          const id = Number(makeBtn.dataset.id)
          if (id) {
            try {
              await window.CFApi.eatFood(id, 'home')
              refresh()
              if (window.CFModals && typeof window.CFModals.closeAll === 'function') {
                window.CFModals.closeAll()
              }
            } catch (err) {
              console.error('eatFood failed:', err)
              alert('Could not log meal: ' + (err.message || err))
            }
          }
        }
        return
      }

      // ADD TO SHOPPING (food card OR modal button)
      const shopBtn = e.target.closest('[data-action="add-shopping"]')
      if (shopBtn) {
        if (window.CFApi && typeof window.CFApi.addToShoppingFromFood === 'function') {
          const id = Number(shopBtn.dataset.id)
          if (id) {
            try {
              await window.CFApi.addToShoppingFromFood(id)
              alert('Added to shopping list!')
              refresh()
            } catch (err) {
              console.error('addToShoppingFromFood failed:', err)
              alert('Could not add to shopping list: ' + (err.message || err))
            }
          }
        }
        return
      }

      // EAT ONE (prep row)
      const eatOneBtn = e.target.closest('[data-action="eat-one"]')
      if (eatOneBtn) {
        if (window.CFApi && typeof window.CFApi.eatFood === 'function') {
          const id = Number(eatOneBtn.dataset.id)
          if (id) {
            try {
              await window.CFApi.eatFood(id, 'prepped')
              refresh()
            } catch (err) {
              console.error('eatFood (prepped) failed:', err)
              alert('Could not log meal: ' + (err.message || err))
            }
          }
        }
        return
      }

      // Ingredient toggle (admin only — defense in depth; render also gates)
      const ingToggle = e.target.closest('.ing-toggle')
      if (ingToggle) {
        if (localStorage.getItem('cf_admin') !== 'true') return
        if (!window.CFApi || typeof window.CFApi.toggleIngredient !== 'function') return
        const row = ingToggle.closest('.ingredient-row')
        const id = Number(row && row.dataset && row.dataset.id)
        if (!id) return
        // Determine current 'have' state from the rendered status pill
        const status = row.querySelector('.ing-status')
        const have = !!(status && status.classList.contains('ing-have'))
        try {
          await window.CFApi.toggleIngredient(id, !have)
          refresh()
        } catch (err) {
          console.error('toggleIngredient failed:', err)
          alert('Could not toggle ingredient: ' + (err.message || err))
        }
        return
      }

      // Food card click → open detail (ignore if click was on a button inside)
      const card = e.target.closest('.food-card')
      if (card && !e.target.closest('button')) {
        const id = Number(card.dataset.id)
        const food = (state.foods || []).find((f) => f.id === id)
        if (food && window.CFModals && typeof window.CFModals.openDetail === 'function') {
          window.CFModals.openDetail(food)
        }
        return
      }
    })
  }

  // ---------- boot ----------
  const init = async () => {
    wireFilters()
    wireGlobalClicks()
    await refresh()
  }

  // Expose CFApp early so modals.js / admin.js can call refresh() at any time
  window.CFApp = { refresh, state }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
