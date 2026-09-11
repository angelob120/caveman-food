// frontend/js/modals.js
// Modal open/close logic for #cf-detail-modal, #cf-random-modal, #cf-admin-modal.
// Renders modal body content. Relies on global click delegation in app.js
// to handle [data-action="make"] / [data-action="add-shopping"] clicks.

(function () {
  'use strict'

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

  const money = (n) => {
    if (n == null || isNaN(Number(n))) return ''
    return '$' + Number(n).toFixed(2)
  }

  const refresh = () => {
    if (window.CFApp && typeof window.CFApp.refresh === 'function') {
      window.CFApp.refresh()
    }
  }

  const findEl = (id) => document.getElementById(id)

  // ---------- public API ----------
  const closeAll = () => {
    document.querySelectorAll('.modal').forEach((m) => m.classList.add('hidden'))
  }

  const showModal = (id) => {
    closeAll()
    const el = findEl(id)
    if (el) el.classList.remove('hidden')
  }

  // ---------- detail modal ----------
  const renderIngredientLine = (ing) => {
    const ok = !!ing.have
    const icon = ok ? '✓' : '✕'
    const cls = ok ? 'ing-have' : 'ing-miss'
    const storeTag = ing.store_name
      ? ` <span class="ing-store-tag">(${escape(ing.store_name)})</span>`
      : ''
    return `<li class="${cls}"><span class="ing-icon">${icon}</span> ${escape(ing.name)}${storeTag}</li>`
  }

  const renderInstructions = (text) => {
    if (!text || !String(text).trim()) {
      return '<p class="empty">No instructions.</p>'
    }
    const lines = String(text)
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    if (lines.length === 0) {
      return '<p class="empty">No instructions.</p>'
    }
    if (lines.length === 1) {
      return `<ol class="steps single"><li>${escape(lines[0])}</li></ol>`
    }
    return (
      '<ol class="steps">' +
      lines.map((l) => `<li>${escape(l)}</li>`).join('') +
      '</ol>'
    )
  }

  const openDetail = (food) => {
    if (!food) return
    const body = findEl('cf-detail-body')
    if (!body) return

    const storeName = (food.primary_store && food.primary_store.name) || '—'
    const ingredients = Array.isArray(food.ingredients) ? food.ingredients : []
    const missing = Array.isArray(food.missing_ingredients)
      ? food.missing_ingredients
      : []
    const status = food.status || 'ready'

    body.innerHTML = `
      <header class="detail-head">
        <div class="detail-emoji">${escape(food.image || '🍽️')}</div>
        <div class="detail-titles">
          <h2 class="detail-name">${escape(food.name || '')}</h2>
          <div class="detail-meta">
            ${money(food.cost_per_meal)}${food.cost_per_meal != null ? ' per meal' : ''}
            · ${food.cook_minutes || 0} min
            · ${escape(storeName)}
            ${food.calories ? '· ' + food.calories + ' cal' : ''}
          </div>
          <div class="detail-status status-${escape(status)}">${escape(status.toUpperCase())}</div>
        </div>
      </header>

      ${
        missing.length
          ? `<p class="detail-missing">⚠️ Missing: ${missing.map(escape).join(', ')}</p>`
          : ''
      }

      <section class="detail-section">
        <h3>Ingredients</h3>
        <ul class="detail-ingredients">
          ${ingredients.length ? ingredients.map(renderIngredientLine).join('') : '<li class="empty">No ingredients listed.</li>'}
        </ul>
      </section>

      <section class="detail-section">
        <h3>Instructions</h3>
        ${renderInstructions(food.instructions)}
      </section>

      <div class="detail-actions">
        <button class="btn btn-primary big" data-action="make" data-id="${food.id}">🍽️ MAKE THIS</button>
        <button class="btn big" data-action="add-shopping" data-id="${food.id}">➕ ADD TO SHOPPING</button>
      </div>
    `

    showModal('cf-detail-modal')
  }

  // ---------- random modal ----------
  const openRandom = async () => {
    if (!window.CFApi || typeof window.CFApi.randomFood !== 'function') {
      alert('API not loaded yet.')
      return
    }
    let food
    try {
      food = await window.CFApi.randomFood()
    } catch (err) {
      alert('No food available: ' + (err && err.message ? err.message : err))
      return
    }
    if (!food) return

    const body = findEl('cf-random-body')
    if (!body) return

    const storeName = (food.primary_store && food.primary_store.name) || '—'
    body.innerHTML = `
      <div class="random-card">
        <div class="random-emoji">${escape(food.image || '🍽️')}</div>
        <h2 class="random-name">${escape(food.name || '')}</h2>
        <div class="random-meta">
          ${money(food.cost_per_meal)}${food.cost_per_meal != null ? ' per meal' : ''}
          · ${food.cook_minutes || 0} min
          · ${escape(storeName)}
          ${food.calories ? '· ' + food.calories + ' cal' : ''}
        </div>
        <div class="random-status status-${escape(food.status || 'ready')}">
          ${escape((food.status || 'ready').toUpperCase())}
        </div>
        <button class="btn btn-primary big" data-action="make" data-id="${food.id}">🍽️ MAKE IT</button>
      </div>
    `

    showModal('cf-random-modal')
  }

  // ---------- admin login modal ----------
  const openAdminLogin = () => {
    showModal('cf-admin-modal')
    // clear + focus
    const pwInput = findEl('cf-admin-pw')
    const errEl = findEl('cf-admin-error')
    if (pwInput) {
      pwInput.value = ''
      setTimeout(() => pwInput.focus(), 30)
    }
    if (errEl) errEl.textContent = ''
  }

  const handleAdminSubmit = () => {
    const submit = findEl('cf-admin-submit')
    if (!submit) return

    submit.addEventListener('click', (e) => {
      e.preventDefault()
      trySubmit()
    })

    const pwField = findEl('cf-admin-pw')
    if (pwField) {
      pwField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          trySubmit()
        }
      })
    }
  }

  const trySubmit = () => {
    const pwInput = findEl('cf-admin-pw')
    const errEl = findEl('cf-admin-error')
    const pw = (pwInput && pwInput.value) || ''
    if (pw !== '123') {
      if (errEl) {
        errEl.textContent = '❌ Wrong password'
        errEl.className = 'admin-error show'
      }
      if (pwInput) {
        pwInput.value = ''
        pwInput.focus()
      }
      return
    }
    localStorage.setItem('cf_admin', 'true')
    localStorage.setItem('cf_admin_pw', pw)
    if (pwInput) pwInput.value = ''
    if (errEl) errEl.textContent = ''
    closeAll()
    if (window.CFAdmin && typeof window.CFAdmin.onAdminModeChange === 'function') {
      window.CFAdmin.onAdminModeChange()
    }
    refresh()
  }

  // ---------- backdrop close + [data-close] ----------
  document.addEventListener('click', (e) => {
    // explicit close button
    if (e.target.closest('[data-close]')) {
      closeAll()
      return
    }
    // backdrop click (click on .modal but not on .modal-content or its descendants)
    const modal = e.target.closest('.modal')
    if (modal && e.target === modal) {
      closeAll()
    }
  })

  // Escape closes any open modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAll()
  })

  // ---------- boot ----------
  const boot = () => {
    handleAdminSubmit()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }

  // expose
  window.CFModals = { openDetail, openRandom, openAdminLogin, closeAll }
})()
