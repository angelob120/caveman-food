// frontend/js/app.js
// Entry point. Loads dashboard, wires search, filters, click delegation.
// Apple Sign-in: the dashboard + admin panel are only available when signed
// in. The lock icon in the header kicks off the Apple flow when signed out.

(function () {
  const state = {
    dashboard: null,
    foods: [],
    ingredients: [],
    stores: [],
    activeFilters: new Set(),
    searchQuery: '',
    showArchived: false,
    signedIn: false
  }

  function root(id) {
    return document.getElementById(id)
  }

  // "Admin" is now synonymous with "signed in" — there's no separate unlock.
  function isAdmin() { return state.signedIn }

  function setAdminMode(on) {
    state.signedIn = !!on
    document.body.classList.toggle('admin-mode', state.signedIn)
    const badge = root('cf-admin-badge')
    if (badge) badge.classList.toggle('hidden', !state.signedIn)
    const qa = root('cf-quick-add')
    if (qa) qa.classList.toggle('hidden', !state.signedIn)
  }

  async function refresh() {
    try {
      const data = await window.CFApi.getDashboard()
      state.dashboard = data
      state.foods = (data && data.foods) || []
      state.ingredients = (data && data.ingredients) || []
      state.stores = (data && data.stores) || []
      renderAll()
    } catch (err) {
      console.error('refresh failed:', err)
      // 401: session expired, prompt sign-in.
      if (err && err.status === 401) {
        setAdminMode(false)
        const modal = root('cf-admin-modal')
        if (modal) modal.classList.remove('hidden')
      }
    }
  }

  function renderAll() {
    const d = state.dashboard || {}

    const ready = state.foods.filter(function (f) { return f.status === 'ready' })
    window.CFRender.renderWhatCanIMake(root('cf-wcm-list'), ready)

    const filterArr = Array.from(state.activeFilters)
    const visible = state.foods.filter(function (f) {
      if (f.active === false) {
        if (!state.signedIn || !state.showArchived) return false
      }
      return true
    })
    window.CFRender.renderFoodGrid(
      root('cf-food-grid'),
      visible,
      filterArr,
      d.prepped || [],
      state.searchQuery,
      { showArchived: state.showArchived }
    )

    const totalActive = visible.length
    const shown = root('cf-food-grid').children.length
    window.CFRender.renderBrowseMeta(
      root('cf-browse-meta'),
      shown,
      totalActive,
      state.searchQuery,
      filterArr
    )

    window.CFRender.renderPrepped(
      root('cf-prep-targets'),
      root('cf-prep-list'),
      d.prep_targets || {},
      d.prepped || []
    )
    window.CFRender.renderShopping(
      root('cf-shop-list'),
      root('cf-shop-grand'),
      d.shopping || {}
    )
    window.CFRender.renderStats(
      root('cf-week-stats'),
      root('cf-month-stats'),
      d.stats || {}
    )
    window.CFRender.renderIngredients(
      root('cf-ingredient-list'),
      state.ingredients
    )

    if (state.signedIn) {
      refreshAdminFoodList()
      const grid = root('cf-admin-ingredient-grid')
      if (grid && grid.children.length === 0) {
        window.CFRender.renderIngredientChips(grid, state.ingredients, [])
      }
      const storeSel = root('cf-admin-ing-store')
      if (storeSel && storeSel.options.length === 0) {
        for (const s of state.stores) {
          const opt = document.createElement('option')
          opt.value = s.id
          opt.textContent = s.name
          storeSel.appendChild(opt)
        }
      }
    }
  }

  async function refreshAdminFoodList() {
    try {
      const allFoods = await window.CFApi.getFoods(null, { includeArchived: true })
      const panel = root('cf-admin-food-list')
      if (panel) {
        window.CFRender.renderAdminFoodList(panel, allFoods)
      }
    } catch (err) {
      console.error('refreshAdminFoodList failed:', err)
    }
  }

  function bindFilters() {
    const bar = root('cf-filters')
    if (!bar) return
    bar.addEventListener('click', function (e) {
      const pill = e.target.closest('.filter-pill')
      if (!pill) return
      const action = pill.dataset.action
      const key = pill.dataset.filter
      if (action === 'clear-filters') {
        state.activeFilters.clear()
        state.searchQuery = ''
        const search = root('cf-search')
        if (search) search.value = ''
        for (const p of bar.querySelectorAll('.filter-pill.active')) {
          p.classList.remove('active')
        }
        renderAll()
        return
      }
      if (!key) return
      if (state.activeFilters.has(key)) {
        state.activeFilters.delete(key)
        pill.classList.remove('active')
      } else {
        state.activeFilters.add(key)
        pill.classList.add('active')
      }
      renderAll()
    })
  }

  function bindSearch() {
    const search = root('cf-search')
    if (!search) return
    let timer = null
    search.addEventListener('input', function () {
      clearTimeout(timer)
      timer = setTimeout(function () {
        state.searchQuery = search.trim ? search.trim() : (search.value || '').trim()
        renderAll()
      }, 80)
    })
  }

  function bindClicks() {
    document.addEventListener('click', async function (e) {
      const mini = e.target.closest('.cf-mini-card')
      if (mini && !e.target.closest('button')) {
        const id = parseInt(mini.dataset.id, 10)
        if (Number.isFinite(id)) await makeFood(id, 'home')
        return
      }
      const miniMake = e.target.closest('.cf-mini-card [data-action="make"]')
      if (miniMake) {
        const id = parseInt(miniMake.dataset.id, 10)
        if (Number.isFinite(id)) await makeFood(id, miniMake.dataset.source || 'home')
        return
      }
      const card = e.target.closest('.food-card')
      if (card && !e.target.closest('button')) {
        const id = parseInt(card.dataset.id, 10)
        if (Number.isFinite(id)) {
          const food = state.foods.find(function (f) { return f.id === id })
          if (food) window.CFModals.openDetail(food)
        }
        return
      }
      const make = e.target.closest('.food-card [data-action="make"]')
      if (make) {
        const id = parseInt(make.dataset.id, 10)
        if (Number.isFinite(id)) await makeFood(id, 'home')
        return
      }
      const addShop = e.target.closest('.food-card [data-action="add-shopping"]')
      if (addShop) {
        const id = parseInt(addShop.dataset.id, 10)
        if (Number.isFinite(id)) await addToShopping(id)
        return
      }
      const archBtn = e.target.closest('.food-card .cf-card-archive')
      if (archBtn) {
        const id = parseInt(archBtn.dataset.id, 10)
        const action = archBtn.dataset.action
        if (Number.isFinite(id) && window.CFAdmin) {
          await window.CFAdmin.archiveFood(id, action)
          renderAll()
          await refreshAdminFoodList()
        }
        return
      }
      if (e.target.closest('#cf-shop-bought')) {
        try {
          await window.CFApi.markBought()
          await refresh()
        } catch (err) {
          console.error('markBought failed:', err)
          alert('Could not update shopping list: ' + (err.message || err))
        }
        return
      }
      const eatOne = e.target.closest('[data-action="eat-one"]')
      if (eatOne) {
        const id = parseInt(eatOne.dataset.id, 10)
        if (Number.isFinite(id)) await makeFood(id, 'prepped')
        return
      }
      const ingToggle = e.target.closest('.ing-toggle')
      if (ingToggle) {
        const id = parseInt(ingToggle.dataset.id, 10)
        if (!Number.isFinite(id)) return
        const row = ingToggle.closest('.ingredient-row')
        const newHave = ingToggle.textContent.indexOf('HAVE') !== -1
        try {
          await window.CFApi.toggleIngredient(id, newHave)
          await refresh()
        } catch (err) { console.error('toggle failed:', err) }
        return
      }
      if (e.target.closest('#cf-idk-btn')) {
        window.CFModals.openRandom()
        return
      }
      if (e.target.closest('#cf-admin-btn')) {
        if (state.signedIn) {
          await window.CFApi.logout()
          location.reload()
        } else {
          const modal = root('cf-admin-modal')
          if (modal) modal.classList.remove('hidden')
        }
        return
      }
      if (e.target.closest('#cf-quick-add')) {
        const manage = root('cf-manage')
        if (manage) manage.open = true
        const panel = root('cf-admin-panel')
        if (panel) {
          panel.classList.remove('hidden')
          panel.scrollIntoView({ behavior: 'smooth', block: 'start' })
          const firstInput = panel.querySelector('input[name="name"]')
          if (firstInput) setTimeout(function () { firstInput.focus() }, 350)
        }
        return
      }
    })
  }

  async function makeFood(id, source) {
    try {
      await window.CFApi.eatFood(id, source)
      toast(source === 'prepped' ? '✓ Box eaten' : '✓ Logged')
      await refresh()
    } catch (err) {
      console.error('makeFood failed:', err)
      alert('Could not log: ' + (err.message || err))
    }
  }

  async function addToShopping(id) {
    try {
      const result = await window.CFApi.addToShoppingFromFood(id)
      const added = (result && result.added && result.added.length) || 0
      toast(added > 0 ? '✓ Added ' + added + ' to shopping' : '✓ Already have it all')
      await refresh()
    } catch (err) {
      console.error('addToShopping failed:', err)
      alert('Could not add to shopping: ' + (err.message || err))
    }
  }

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

  function bindAdminToggles() {
    const arch = root('cf-admin-show-archived')
    if (arch) {
      arch.addEventListener('change', function () {
        state.showArchived = arch.checked
        renderAll()
      })
    }
  }

  async function init() {
    // Check session first — if signed in, load the dashboard; otherwise show
    // an empty page with the "Sign in" prompt in the header.
    let me
    try { me = await window.CFApi.me() } catch { me = { signedIn: false } }
    setAdminMode(!!me.signedIn)
    if (me.signedIn && me.uid) state.uid = me.uid

    bindFilters()
    bindSearch()
    bindClicks()
    bindAdminToggles()

    if (state.signedIn) {
      await refresh()
    } else {
      // Render empty sections so the page isn't a pile of "Loading…"
      renderAll()
    }

    // Refresh on focus so the dashboard stays current across sign-ins/outs.
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const fresh = await window.CFApi.me()
        if (!!fresh.signedIn !== state.signedIn) location.reload()
        else if (state.signedIn) await refresh()
      } catch {}
    })
  }

  window.CFApp = {
    refresh: refresh,
    state: state,
    setAdminMode: setAdminMode,
    renderAll: renderAll
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
