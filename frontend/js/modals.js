// frontend/js/modals.js
// Modal open/close logic for #cf-detail-modal, #cf-random-modal, #cf-admin-modal.
// Relies on global click delegation in app.js for action buttons inside modals.

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
    return '~$' + Number(n).toFixed(2)
  }

  const fmtTime = (min) => {
    if (typeof min !== 'number') return ''
    return min + ' min'
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

  const statusClass = (s) => {
    if (s === 'ready') return 'status-ready'
    if (s === 'need_shop') return 'status-need-shop'
    if (s === 'missing') return 'status-missing'
    return 'status-missing'
  }
  const statusLabel = (s) => {
    if (s === 'ready') return '🟢 READY'
    if (s === 'need_shop') return '🔴 NEED SHOP'
    if (s === 'missing') return '🟡 MISSING'
    return s
  }

  // ---------- detail modal ----------
  const renderIngredientLine = (ing) => {
    const ok = !!ing.have
    const cls = ok ? 'have' : 'missing'
    const icon = ok ? '✓' : '✕'
    const storeTag = ing.store_name
      ? ` <span class="dim">(${escape(ing.store_name)})</span>`
      : ''
    return `<li class="${cls}"><span class="dim">${icon}</span> ${escape(ing.name)}${storeTag}</li>`
  }

  const renderInstructions = (text) => {
    if (!text || !String(text).trim()) {
      return '<p class="empty">No instructions.</p>'
    }
    const lines = String(text)
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    if (lines.length === 0) return '<p class="empty">No instructions.</p>'
    if (lines.length === 1) return `<ol class="detail-steps single"><li>${escape(lines[0])}</li></ol>`
    return '<ol class="detail-steps">' + lines.map((l) => `<li>${escape(l)}</li>`).join('') + '</ol>'
  }

  const openDetail = (food) => {
    if (!food) return
    const body = findEl('cf-detail-body')
    if (!body) return

    const storeName = (food.primary_store && food.primary_store.name) || '—'
    const ingredients = Array.isArray(food.ingredients) ? food.ingredients : []
    const missing = Array.isArray(food.missing_ingredients) ? food.missing_ingredients : []
    const status = food.status || 'ready'

    body.innerHTML = `
      <div class="detail-head">
        <span class="detail-emoji">${escape(food.image || '🍽️')}</span>
        <div>
          <h2 class="detail-title">${escape(food.name || '')}</h2>
          <div class="detail-meta">
            <strong>${money(food.cost_per_meal)}</strong> per meal
            · ${fmtTime(food.cook_minutes)}
            · ${escape(storeName)}
            ${food.calories ? '· ' + food.calories + ' cal' : ''}
          </div>
          <div class="status ${statusClass(status)}" style="margin-top:6px;">${statusLabel(status)}</div>
        </div>
      </div>

      ${
        missing.length
          ? `<p class="detail-missing">⚠️ Missing: ${missing.map(escape).join(', ')}</p>`
          : ''
      }

      <div class="detail-section">
        <h4>Ingredients</h4>
        <ul class="detail-ingredients">
          ${ingredients.length ? ingredients.map(renderIngredientLine).join('') : '<li class="empty">No ingredients listed.</li>'}
        </ul>
      </div>

      <div class="detail-section">
        <h4>Instructions</h4>
        ${renderInstructions(food.instructions_short || food.instructions)}
      </div>

      <div class="detail-actions">
        <button class="primary" data-action="make" data-id="${food.id}">🍴 MAKE THIS</button>
        <button class="secondary" data-action="add-shopping" data-id="${food.id}">🛒 Shopping</button>
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
      <div class="random-body">
        <div class="detail-emoji">${escape(food.image || '🍽️')}</div>
        <h2 class="detail-title" style="font-size:1.4rem;">${escape(food.name || '')}</h2>
        <div class="detail-meta" style="justify-content:center;">
          <strong>${money(food.cost_per_meal)}</strong> per meal
          · ${fmtTime(food.cook_minutes)}
        </div>
        <div class="status ${statusClass(food.status)}" style="margin: 10px auto; display: inline-block;">${statusLabel(food.status)}</div>
        <p class="dim" style="margin: 12px 0;">${food.calories ? food.calories + ' cal · ' : ''}from ${escape(storeName)}</p>
        <button class="primary big-btn" data-action="make" data-id="${food.id}" style="width:100%; margin-top: 12px;">🍴 MAKE IT</button>
      </div>
    `

    showModal('cf-random-modal')
  }

  // ---------- admin login modal ----------
  const openAdminLogin = () => {
    showModal('cf-admin-modal')
    const pwInput = findEl('cf-admin-pw')
    if (pwInput) {
      pwInput.value = ''
      setTimeout(() => pwInput.focus(), 30)
    }
  }

  const trySubmit = () => {
    const pwInput = findEl('cf-admin-pw')
    const pw = (pwInput && pwInput.value) || ''
    if (pw !== '123') {
      if (pwInput) {
        pwInput.value = ''
        pwInput.focus()
      }
      alert('❌ Wrong password')
      return
    }
    localStorage.setItem('cf_admin', 'true')
    localStorage.setItem('cf_admin_pw', pw)
    if (pwInput) pwInput.value = ''
    closeAll()
    if (window.CFAdmin && typeof window.CFAdmin.onAdminModeChange === 'function') {
      window.CFAdmin.onAdminModeChange()
    }
    refresh()
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

  // ---------- backdrop close + [data-close] + Escape ----------
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) {
      closeAll()
      return
    }
    const modal = e.target.closest('.modal')
    if (modal && e.target === modal) closeAll()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAll()
  })

  const boot = () => {
    handleAdminSubmit()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }

  window.CFModals = { openDetail, openRandom, openAdminLogin, closeAll }
})()
