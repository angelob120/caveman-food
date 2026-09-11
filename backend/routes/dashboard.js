// GET /api/dashboard — composite payload for the homepage.

const express = require('express')
const { composeDashboard } = require('../lib/dashboard')
const { attachSession } = require('../middleware/auth')

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    // Dashboard requires sign-in so we can scope everything by Apple sub.
    const uid = await attachSession(req);
    if (!uid) return res.status(401).json({ error: 'sign-in required' });
    req.uid = uid;
    const payload = await composeDashboard(uid)
    res.json(payload)
  } catch (err) {
    console.error('GET /api/dashboard failed:', err)
    res.status(500).json({ error: err.message || 'dashboard failed' })
  }
})

module.exports = router
