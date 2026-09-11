// Admin auth middleware.
// Reads expected password from (in priority order):
//   1. ADMIN_PASSWORD env var
//   2. settings.admin_password in the DB (refreshed via app.locals.settings)
//   3. hardcoded '123' (V1 default)

const getExpectedPassword = (req) => {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD
  const fromDb = req.app?.locals?.settings?.admin_password
  if (fromDb) return fromDb
  return '123'
}

const requireAdmin = (req, res, next) => {
  const provided = req.header('x-admin-password')
  const expected = getExpectedPassword(req)
  if (provided !== expected) {
    return res.status(401).json({ error: 'admin password required' })
  }
  next()
}

module.exports = { requireAdmin, getExpectedPassword }
