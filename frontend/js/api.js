// frontend/js/api.js
// Pure fetch wrappers. Exposes window.CFApi.
// All requests go to /api/*. The browser sends the Apple session cookie
// same-origin by default, so per-user scoping works without any headers.

(function () {
  const API_BASE = '/api'

  async function request(path, options = {}) {
    const url = path.startsWith('http') ? path : API_BASE + path
    const opts = Object.assign({ headers: {} }, options)
    if (opts.body && typeof opts.body !== 'string') {
      opts.body = JSON.stringify(opts.body)
      opts.headers['Content-Type'] = 'application/json'
    }
    const res = await fetch(url, Object.assign({ credentials: 'same-origin' }, opts))
    const isJson = (res.headers.get('content-type') || '').includes('application/json')
    const data = isJson ? await res.json().catch(() => null) : null
    if (!res.ok) {
      const msg = (data && data.error) ? data.error : ('HTTP ' + res.status)
      const err = new Error(msg)
      err.status = res.status
      err.data = data
      throw err
    }
    return data
  }

  const api = {
    // Returns { signedIn: bool, uid?: string }.
    async me() {
      return fetch('/auth/me', { credentials: 'same-origin' })
        .then((r) => r.json().catch(() => ({ signedIn: false })))
    },

    async logout() {
      return fetch('/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      }).then((r) => r.json().catch(() => ({ ok: true })))
    },

    async getDashboard() {
      return request('/dashboard', { method: 'GET' })
    },

    async getFoods(type, opts) {
      const params = []
      if (type) params.push('type=' + encodeURIComponent(type))
      if (opts && opts.includeArchived) params.push('include_archived=true')
      const q = params.length ? ('?' + params.join('&')) : ''
      return request('/foods' + q, { method: 'GET' })
    },

    async getFood(id) {
      return request('/foods/' + encodeURIComponent(id), { method: 'GET' })
    },

    async randomFood() {
      return request('/foods/random', { method: 'GET' })
    },

    async eatFood(id, source) {
      return request('/foods/' + encodeURIComponent(id) + '/eat', {
        method: 'POST',
        body: { source }
      })
    },

    async addToShoppingFromFood(foodId) {
      return request('/shopping/from-food/' + encodeURIComponent(foodId), {
        method: 'POST'
      })
    },

    async markBought() {
      return request('/shopping/bought', {
        method: 'POST'
      })
    },

    async toggleIngredient(id, have) {
      return request('/ingredients/' + encodeURIComponent(id), {
        method: 'PATCH',
        body: { have: !!have }
      })
    },

    async logFood(body) {
      return request('/food-log', {
        method: 'POST',
        body: body || {}
      })
    }
  }

  window.CFApi = api
})()
