// frontend/js/api.js
// Pure fetch wrappers. Exposes window.CFApi.
// Style: 2-space indent, single quotes, no semicolons, modern JS.

(function () {
  const API_BASE = '/api'

  function adminHeader() {
    if (typeof localStorage !== 'undefined' && localStorage.cf_admin === 'true') {
      return { 'Content-Type': 'application/json', 'x-admin-password': '123' }
    }
    return { 'Content-Type': 'application/json' }
  }

  async function request(path, options = {}) {
    const url = path.startsWith('http') ? path : API_BASE + path
    const opts = Object.assign({ headers: {} }, options)
    if (opts.body && typeof opts.body !== 'string') {
      opts.body = JSON.stringify(opts.body)
      opts.headers['Content-Type'] = 'application/json'
    }
    const res = await fetch(url, opts)
    const isJson = (res.headers.get('content-type') || '').includes('application/json')
    const data = isJson ? await res.json() : null
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
    adminHeader,

    async getDashboard() {
      return request('/dashboard', { method: 'GET' })
    },

    async getFoods(type) {
      const q = type ? ('?type=' + encodeURIComponent(type)) : ''
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
        headers: adminHeader(),
        body: { source }
      })
    },

    async addToShoppingFromFood(foodId) {
      return request('/shopping/from-food/' + encodeURIComponent(foodId), {
        method: 'POST',
        headers: adminHeader()
      })
    },

    async markBought() {
      return request('/shopping/bought', {
        method: 'POST',
        headers: adminHeader()
      })
    },

    async toggleIngredient(id, have) {
      return request('/ingredients/' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: adminHeader(),
        body: { have: !!have }
      })
    },

    async logFood(body) {
      return request('/food-log', {
        method: 'POST',
        headers: adminHeader(),
        body: body || {}
      })
    }
  }

  window.CFApi = api
})()
