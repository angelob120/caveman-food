// frontend/js/render.js
// Pure render functions. No event listeners. Exposes window.CFRender.
// Daily-use: hero mini-cards (1-tap MAKE), inline archive button (admin),
// search filter (name + ingredients), archive rendering.

(function () {
  // ---------- helpers ----------

  function el(tag, props, children) {
    const node = document.createElement(tag)
    if (props) {
      for (const k in props) {
        if (k === 'class') node.className = props[k]
        else if (k === 'text') node.textContent = props[k]
        else if (k === 'html') node.innerHTML = props[k]
        else if (k === 'dataset') {
          for (const dk in props[k]) node.dataset[dk] = props[k][dk]
        } else {
          node.setAttribute(k, props[k])
        }
      }
    }
    if (children) {
      const arr = Array.isArray(children) ? children : [children]
      for (const c of arr) {
        if (c == null) continue
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c)
      }
    }
    return node
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild)
  }

  function fmtMoney(n) {
    if (typeof n !== 'number') return ''
    return '~$' + n.toFixed(2)
  }

  function fmtTime(min) {
    if (typeof min !== 'number') return ''
    return min + ' min'
  }

  function statusClass(status) {
    if (status === 'ready') return 'status-ready'
    if (status === 'need_shop') return 'status-need-shop'
    if (status === 'missing') return 'status-missing'
    return 'status-missing'
  }

  function statusLabel(status) {
    if (status === 'ready') return '🟢 READY'
    if (status === 'need_shop') return '🔴 NEED SHOP'
    if (status === 'missing') return '🟡 MISSING'
    return status
  }

  function statusLabelShort(status) {
    if (status === 'ready') return '🟢'
    if (status === 'need_shop') return '🔴'
    if (status === 'missing') return '🟡'
    return ''
  }

  function primaryStoreName(food) {
    if (food && food.primary_store && food.primary_store.name) return food.primary_store.name
    return ''
  }

  function isAdmin() {
    return typeof localStorage !== 'undefined' && localStorage.cf_admin === 'true'
  }

  function matchesSearch(food, query) {
    if (!query) return true
    const q = query.toLowerCase()
    if ((food.name || '').toLowerCase().indexOf(q) !== -1) return true
    const ings = Array.isArray(food.ingredients) ? food.ingredients : []
    for (const ing of ings) {
      if (ing && ing.name && ing.name.toLowerCase().indexOf(q) !== -1) return true
    }
    return false
  }

  // ---------- HERO MINI CARD (1-tap MAKE THIS for the daily flow) ----------

  function miniCardEl(food) {
    const status = food.status || 'missing'
    return el('div', {
      class: 'cf-mini-card',
      dataset: { id: food.id, status: status, type: food.food_type || '' }
    }, [
      el('span', { class: 'cf-mini-emoji', text: food.image || '🍽️' }),
      el('span', { class: 'cf-mini-name', text: food.name || '' }),
      el('span', { class: 'cf-mini-cost', text: fmtMoney(food.cost_per_meal) }),
      el('button', {
        'data-action': 'make',
        'data-id': food.id,
        'data-source': 'home',
        class: 'cf-mini-make',
        text: '🍴 EAT'
      })
    ])
  }

  // ---------- MAIN FOOD CARD (with optional archive button) ---------------

  function foodCardEl(food) {
    const status = food.status || 'missing'
    const archived = food.active === false
    const card = el('article', {
      class: 'food-card',
      dataset: {
        id: food.id,
        status: status,
        type: food.food_type || '',
        archived: archived ? 'true' : 'false'
      }
    })

    const top = el('div', { class: 'food-card-top' }, [
      el('span', { class: 'food-emoji', text: food.image || '🍽️' }),
      el('h3', { class: 'food-name', text: food.name || '' }),
      el('span', { class: 'status ' + statusClass(status), text: statusLabel(status) })
    ])
    card.appendChild(top)

    // Cost + time meta (cost highlighted)
    const parts = []
    if (typeof food.cost_per_meal === 'number') parts.push(el('span', { class: 'cost', text: fmtMoney(food.cost_per_meal) }))
    if (typeof food.cook_minutes === 'number') parts.push(el('span', { text: fmtTime(food.cook_minutes) }))
    const store = primaryStoreName(food)
    if (store) parts.push(el('span', { text: store }))
    if (archived) parts.push(el('span', { text: 'ARCHIVED', class: 'archived-tag' }))
    const meta = el('div', { class: 'food-meta' }, parts)
    card.appendChild(meta)

    const ul = el('ul', { class: 'ingredients-compact' })
    const ings = Array.isArray(food.ingredients) ? food.ingredients : []
    for (const ing of ings) {
      const li = el('li', {
        text: ing && ing.name ? ing.name : '',
        class: ing && ing.have ? 'have' : ''
      })
      ul.appendChild(li)
    }
    card.appendChild(ul)

    // Primary CTA — MAKE THIS (the daily use case)
    const makeBtn = el('button', {
      'data-action': 'make',
      'data-id': food.id,
      class: 'primary',
      text: '🍴 MAKE THIS'
    })
    const shopBtn = el('button', {
      'data-action': 'add-shopping',
      'data-id': food.id,
      text: '🛒 Shopping'
    })
    const actions = el('div', { class: 'food-actions' }, [makeBtn, shopBtn])
    card.appendChild(actions)

    // Inline archive button (admin only)
    if (isAdmin()) {
      const archiveBtn = el('button', {
        class: 'cf-card-archive',
        'data-action': archived ? 'restore' : 'archive',
        'data-id': food.id,
        'aria-label': archived ? 'Restore' : 'Archive'
      })
      card.appendChild(archiveBtn)
    }

    return card
  }

  // ---------- filter logic (AND across active filters + search) -----------

  function matchesFilters(food, activeFilters, preppedFoodIds) {
    if (!Array.isArray(activeFilters) || activeFilters.length === 0) return true
    for (const key of activeFilters) {
      if (key === 'full') {
        if (food.food_type !== 'full') return false
      } else if (key === 'quick') {
        if (food.food_type !== 'quick') return false
      } else if (key === 'snack') {
        if (food.food_type !== 'snack') return false
      } else if (key === 'prepped') {
        const ids = preppedFoodIds || {}
        if (!ids[food.id] || ids[food.id] <= 0) return false
      } else if (key === 'cheap') {
        if (typeof food.cost_per_meal !== 'number' || food.cost_per_meal > 5) return false
      } else if (key === 'fast') {
        if (typeof food.cook_minutes !== 'number' || food.cook_minutes > 15) return false
      }
    }
    return true
  }

  // ---------- HERO: WHAT CAN I MAKE (horizontal mini cards) ---------------

  function renderWhatCanIMake(listEl, foods) {
    if (!listEl) return
    clear(listEl)
    const list = Array.isArray(foods) ? foods : []
    if (list.length === 0) {
      listEl.appendChild(el('div', { class: 'empty', text: 'Nothing ready. Mark ingredients HAVE or check the shopping list.' }))
      return
    }
    for (const food of list) {
      listEl.appendChild(miniCardEl(food))
    }
  }

  // ---------- BROWSE GRID (with search + filters + archive support) -------

  function renderFoodGrid(gridEl, foods, activeFilters, preppedList, searchQuery, options) {
    if (!gridEl) return
    clear(gridEl)
    const list = Array.isArray(foods) ? foods : []

    const opts = options || {}
    const showArchived = !!opts.showArchived
    const admin = isAdmin()

    const preppedIds = {}
    if (Array.isArray(preppedList)) {
      for (const p of preppedList) {
        const f = p && p.food
        const boxes = p && p.boxes_remaining
        if (f && typeof f.id === 'number' && typeof boxes === 'number' && boxes > 0) {
          preppedIds[f.id] = boxes
        }
      }
    }

    const filtered = list.filter(function (food) {
      // Archive filter — public users never see archived
      if (food.active === false) {
        if (!admin || !showArchived) return false
      }
      if (!matchesFilters(food, activeFilters, preppedIds)) return false
      if (!matchesSearch(food, searchQuery)) return false
      return true
    })

    if (filtered.length === 0) {
      const msg = searchQuery
        ? 'No foods match "' + searchQuery + '".'
        : 'No foods match these filters.'
      gridEl.appendChild(el('div', { class: 'empty', text: msg }))
      return
    }

    // Sort: ready first, then missing, then need_shop; alphabetical within
    const order = { ready: 0, missing: 1, need_shop: 2 }
    filtered.sort(function (a, b) {
      const oa = order[a.status] != null ? order[a.status] : 3
      const ob = order[b.status] != null ? order[b.status] : 3
      if (oa !== ob) return oa - ob
      return (a.name || '').localeCompare(b.name || '')
    })

    for (const food of filtered) {
      gridEl.appendChild(foodCardEl(food))
    }
  }

  function renderBrowseMeta(metaEl, totalShown, totalActive, searchQuery, activeFilters) {
    if (!metaEl) return
    clear(metaEl)
    const parts = []
    parts.push(totalShown + ' of ' + totalActive + ' foods')
    if (searchQuery) parts.push('"' + searchQuery + '"')
    if (activeFilters && activeFilters.length) parts.push(activeFilters.length + ' filter' + (activeFilters.length === 1 ? '' : 's'))
    metaEl.appendChild(el('span', { text: parts.join(' · ') }))
  }

  // ---------- PREPPED (target chips + list) -------------------------------

  function renderPrepped(targetsEl, listEl, prepTargets, prepped) {
    if (targetsEl) {
      clear(targetsEl)
      const t = prepTargets || {}
      const fullTarget = typeof t.full_target === 'number' ? t.full_target : 0
      const snackTarget = typeof t.snack_target === 'number' ? t.snack_target : 0
      const fullCurrent = typeof t.full_current === 'number' ? t.full_current : 0
      const snackCurrent = typeof t.snack_current === 'number' ? t.snack_current : 0
      targetsEl.appendChild(el('div', { class: 'prep-target' }, [
        el('div', { class: 'prep-target-num', text: fullCurrent + '/' + fullTarget }),
        el('div', { class: 'prep-target-label', text: 'Full boxes' })
      ]))
      targetsEl.appendChild(el('div', { class: 'prep-target' }, [
        el('div', { class: 'prep-target-num', text: snackCurrent + '/' + snackTarget }),
        el('div', { class: 'prep-target-label', text: 'Snack boxes' })
      ]))
    }

    if (!listEl) return
    clear(listEl)
    const list = Array.isArray(prepped) ? prepped : []
    if (list.length === 0) {
      listEl.appendChild(el('div', { class: 'empty', text: 'No prepped food yet.' }))
      return
    }
    for (const row of list) {
      const food = row && row.food ? row.food : {}
      const boxes = row && typeof row.boxes_remaining === 'number' ? row.boxes_remaining : 0
      const rowEl = el('div', { class: 'prep-row', dataset: { foodId: food.id } }, [
        el('span', { class: 'prep-name', text: food.name || '' }),
        el('span', { class: 'prep-count', text: boxes + ' boxes' }),
        el('button', { 'data-action': 'eat-one', 'data-id': food.id, text: '🍴 EAT ONE' })
      ])
      listEl.appendChild(rowEl)
    }
  }

  // ---------- SHOPPING ----------------------------------------------------

  function renderShopping(shopListEl, shopGrandEl, shopping) {
    if (shopListEl) {
      clear(shopListEl)
      const s = shopping || {}
      const byStore = Array.isArray(s.by_store) ? s.by_store : []
      if (byStore.length === 0) {
        shopListEl.appendChild(el('div', { class: 'empty', text: 'Shopping list is empty.' }))
      } else {
        for (const block of byStore) {
          const store = block && block.store ? block.store : {}
          const items = Array.isArray(block && block.items) ? block.items : []
          const total = block && typeof block.total === 'number' ? block.total : 0
          const blockEl = el('div', { class: 'shop-store-block', dataset: { storeId: store.id } }, [
            el('h3', { text: (store.name || '').toUpperCase() })
          ])
          const ul = el('ul', { class: 'shop-items' })
          for (const item of items) {
            const li = el('li')
            li.appendChild(el('span', { class: 'shop-name', text: item && item.name ? item.name : '' }))
            li.appendChild(el('span', { class: 'shop-price', text: fmtMoney(item && item.price) }))
            ul.appendChild(li)
          }
          blockEl.appendChild(ul)
          blockEl.appendChild(el('div', { class: 'shop-total', text: fmtMoney(total) }))
          shopListEl.appendChild(blockEl)
        }
      }
    }

    if (shopGrandEl) {
      clear(shopGrandEl)
      const grand = shopping && typeof shopping.grand_total === 'number' ? shopping.grand_total : 0
      if (grand > 0) {
        shopGrandEl.appendChild(el('div', {
          class: 'shop-grand-total-inner',
          text: 'TOTAL TRIP ' + fmtMoney(grand)
        }))
      }
    }
  }

  // ---------- STATS -------------------------------------------------------

  function renderStats(weekEl, monthEl, stats) {
    const s = stats || {}
    const week = s.week || {}
    const month = s.month || {}

    if (weekEl) {
      clear(weekEl)
      const rows = [
        ['Home meals eaten', week.home_meals],
        ['Eating-out meals', week.eating_out],
        ['Home cost', fmtMoney(week.home_cost)],
        ['Eating-out cost', fmtMoney(week.out_cost)],
        ['Prep boxes left', week.prep_boxes_left]
      ]
      for (const r of rows) {
        weekEl.appendChild(el('div', { class: 'week-row' }, [
          el('span', { text: r[0] }),
          el('span', { text: r[1] != null ? String(r[1]) : '' })
        ]))
      }
    }

    if (monthEl) {
      clear(monthEl)
      const prev = typeof month.previous_total === 'number' ? month.previous_total : 0
      const total = typeof month.total === 'number' ? month.total : 0
      const diff = prev - total
      let diffText = ''
      if (prev > 0 && diff !== 0) {
        const arrow = diff > 0 ? '↓' : '↑'
        diffText = ' ' + arrow + ' $' + Math.abs(diff).toFixed(0) + ' vs last'
      }
      const rows = [
        ['Groceries', fmtMoney(month.groceries)],
        ['Eating out', fmtMoney(month.eating_out)],
        ['Total this month', fmtMoney(total)],
        ['Previous month', fmtMoney(prev) + diffText]
      ]
      for (const r of rows) {
        monthEl.appendChild(el('div', { class: 'week-row' }, [
          el('span', { text: r[0] }),
          el('span', { text: r[1] != null ? String(r[1]) : '' })
        ]))
      }
    }
  }

  // ---------- INGREDIENTS -------------------------------------------------

  function renderIngredients(ingListEl, ingredients) {
    if (!ingListEl) return
    clear(ingListEl)
    const list = Array.isArray(ingredients) ? ingredients : []
    if (list.length === 0) {
      ingListEl.appendChild(el('div', { class: 'empty', text: 'No ingredients yet.' }))
      return
    }
    const admin = isAdmin()
    for (const ing of list) {
      const have = !!ing.have
      const rowEl = el('div', { class: 'ingredient-row', dataset: { id: ing.id } }, [
        el('span', { class: 'ing-name', text: ing.name || '' }),
        el('span', {
          class: 'ing-status ' + (have ? 'ing-have' : 'ing-out'),
          text: have ? '🟢' : '🔴'
        })
      ])
      if (admin) {
        rowEl.appendChild(el('button', {
          class: 'ing-toggle',
          'data-action': 'toggle',
          'data-id': ing.id,
          text: have ? '→ OUT' : '→ HAVE'
        }))
      }
      ingListEl.appendChild(rowEl)
    }
  }

  // ---------- ADMIN: food list (with archive/restore/delete) -------------

  function renderAdminFoodList(listEl, foods) {
    if (!listEl) return
    clear(listEl)
    const list = Array.isArray(foods) ? foods : []
    if (list.length === 0) {
      listEl.appendChild(el('div', { class: 'empty', text: 'No foods.' }))
      return
    }
    for (const food of list) {
      const archived = food.active === false
      const row = el('div', {
        class: 'cf-admin-food-row',
        dataset: { id: food.id, archived: archived ? 'true' : 'false' }
      })
      row.appendChild(el('span', { text: (food.image || '🍽️') + ' ' + (food.name || '') }))
      const actions = el('div', { class: 'cf-admin-row-actions' })
      if (archived) {
        actions.appendChild(el('button', {
          class: 'cf-restore',
          'data-action': 'restore',
          'data-id': food.id,
          text: 'RESTORE'
        }))
        actions.appendChild(el('button', {
          class: 'cf-delete',
          'data-action': 'delete-food',
          'data-id': food.id,
          text: 'DELETE'
        }))
      } else {
        actions.appendChild(el('button', {
          'data-action': 'archive',
          'data-id': food.id,
          text: 'ARCHIVE'
        }))
      }
      row.appendChild(actions)
      listEl.appendChild(row)
    }
  }

  // ---------- ADMIN: ingredient picker chips -----------------------------

  function renderIngredientChips(containerEl, ingredients, selectedIds) {
    if (!containerEl) return
    clear(containerEl)
    const sel = new Set(selectedIds || [])
    for (const ing of (Array.isArray(ingredients) ? ingredients : [])) {
      const chip = el('div', {
        class: 'cf-ing-chip' + (sel.has(ing.id) ? ' selected' : ''),
        'data-id': ing.id,
        text: ing.name || ''
      })
      containerEl.appendChild(chip)
    }
  }

  // ---------- export ----------

  window.CFRender = {
    foodCardEl: foodCardEl,
    miniCardEl: miniCardEl,
    renderWhatCanIMake: renderWhatCanIMake,
    renderFoodGrid: renderFoodGrid,
    renderBrowseMeta: renderBrowseMeta,
    renderPrepped: renderPrepped,
    renderShopping: renderShopping,
    renderStats: renderStats,
    renderIngredients: renderIngredients,
    renderAdminFoodList: renderAdminFoodList,
    renderIngredientChips: renderIngredientChips
  }
})()
