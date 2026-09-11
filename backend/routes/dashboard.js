// GET /api/dashboard — composite payload for the homepage.

const express = require('express')
const { composeDashboard } = require('../lib/dashboard')

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    const payload = await composeDashboard(req.app)
    res.json(payload)
  } catch (err) {
    console.error('GET /api/dashboard failed:', err)
    res.status(500).json({ error: err.message || 'dashboard failed' })
  }
})

module.exports = router
