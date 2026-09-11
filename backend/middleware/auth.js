// Apple Sign-in for caveman-food.
//
// The password gate is gone. The server sets an HttpOnly session cookie via
// Sign in with Apple for web, keyed to the Apple `sub` (stable per user).
// Every row in every table is scoped by that sub, so two Apple users on the
// same Postgres never see each other's data.
//
// Env vars (Railway):
//   SYNC_API_KEY         — long random string (64+ chars). Signs session cookies.
//   APPLE_WEB_CLIENT_ID  — Services ID, e.g. "sign-in-up".
//   APPLE_BUNDLE_ID      — Apple app bundle id, defaults to "Attendance-app-nfc.tracker".
//   APP_URL              — optional canonical https URL.

const { SignJWT, jwtVerify, createRemoteJWKSet } = require('jose');
const crypto = require('node:crypto');

const SESSION_SECRET = new TextEncoder().encode(process.env.SYNC_API_KEY || 'fallback-only-for-local-dev');
const SESSION_ISSUER = 'caveman-food';
const SESSION_AUDIENCE = 'cf-session';
const SESSION_TTL_S = 30 * 24 * 60 * 60;

const COOKIE = 'cf_session';
const OAUTH_COOKIE = 'cf_oauth';

const APPLE_BUNDLE_ID = process.env.APPLE_BUNDLE_ID || 'Attendance-app-nfc.tracker';
const APPLE_WEB_CLIENT_ID = process.env.APPLE_WEB_CLIENT_ID || '';

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

const APP_URL_ENV = process.env.APP_URL ? process.env.APP_URL.replace(/\/+$/, '') : '';
function appBaseUrl(req) {
  if (APP_URL_ENV) return APP_URL_ENV;
  const proto = (req.get?.('x-forwarded-proto') || 'https').split(',')[0].trim();
  const host = req.get?.('x-forwarded-host') || req.headers?.host || '';
  return `${proto}://${host}`.replace(/\/+$/, '');
}

async function signSession(uid, ttl = `${SESSION_TTL_S}s`) {
  return await new SignJWT({ uid })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(SESSION_SECRET);
}

async function verifySession(token) {
  const { payload } = await jwtVerify(token, SESSION_SECRET, {
    algorithms: ['HS256'],
    issuer: SESSION_ISSUER,
    audience: SESSION_AUDIENCE,
  });
  if (!payload.uid || typeof payload.uid !== 'string') throw new Error('no uid');
  return String(payload.uid);
}

async function signOauthState({ state, nonce }) {
  return await new SignJWT({ state, nonce })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(SESSION_ISSUER)
    .setAudience('cf-oauth')
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(SESSION_SECRET);
}

async function verifyOauthState(token) {
  const { payload } = await jwtVerify(token, SESSION_SECRET, {
    algorithms: ['HS256'],
    issuer: SESSION_ISSUER,
    audience: 'cf-oauth',
  });
  return payload;
}

async function verifyAppleIdentityToken(identityToken, audience, expectedNonce = null) {
  const { payload } = await jwtVerify(identityToken, APPLE_JWKS, {
    algorithms: ['RS256'],
    issuer: APPLE_ISSUER,
    audience,
  });
  if (!payload.sub) throw new Error('no subject');
  if (expectedNonce) {
    const hashed = crypto.createHash('sha256').update(expectedNonce).digest('hex');
    if (payload.nonce !== expectedNonce && payload.nonce !== hashed) {
      throw new Error('nonce mismatch');
    }
  }
  return String(payload.sub);
}

function parseCookies(req) {
  const out = {};
  const raw = req.headers?.cookie;
  if (!raw) return out;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function setCookie(res, name, value, { maxAge, sameSite = 'Lax', httpOnly = true } = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=/; Secure; SameSite=${sameSite}`;
  if (httpOnly) c += '; HttpOnly';
  if (typeof maxAge === 'number') c += `; Max-Age=${maxAge}`;
  res.append('Set-Cookie', c);
}

function clearCookie(res, name, sameSite = 'Lax') {
  res.append('Set-Cookie', `${name}=; Path=/; Secure; HttpOnly; SameSite=${sameSite}; Max-Age=0`);
}

async function attachSession(req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE];
  if (!token) return null;
  try { return await verifySession(token); }
  catch { return null; }
}

// The "admin" gate is now just "signed in". Same Apple ID works everywhere.
function requireSignedIn(req, res, next) {
  attachSession(req).then((uid) => {
    if (!uid) return res.status(401).json({ error: 'sign-in required' });
    req.uid = uid;
    next();
  }).catch(() => res.status(401).json({ error: 'sign-in required' }));
}

// First Apple user inherits the pre-multi-tenant rows (user_id = ''). After
// that, no row can ever be claimed.
async function claimLegacyRowsIfFirstUser(query, uid) {
  const tables = ['stores', 'ingredients', 'foods', 'food_ingredients', 'prep_inventory', 'shopping_list', 'food_log', 'settings'];
  let anyOwned = false;
  for (const t of tables) {
    try {
      const r = await query(`SELECT 1 FROM ${t} WHERE user_id <> '' LIMIT 1`);
      if (r.rows.length > 0) { anyOwned = true; break; }
    } catch { /* table missing on first deploy */ }
  }
  if (anyOwned) return;
  for (const t of tables) {
    try {
      await query(`UPDATE ${t} SET user_id = $1 WHERE user_id = ''`, [uid]);
    } catch { /* ignore */ }
  }
}

async function startWebSignIn(req, res) {
  if (!APPLE_WEB_CLIENT_ID) {
    res.status(503).type('text/plain').send(
      'Web sign-in isn\'t configured yet.\n\n' +
      'Set APPLE_WEB_CLIENT_ID on Railway to the Services ID and redeploy.'
    );
    return;
  }
  const state = crypto.randomBytes(16).toString('hex');
  const nonce = crypto.randomBytes(16).toString('hex');
  const stateToken = await signOauthState({ state, nonce });
  setCookie(res, OAUTH_COOKIE, stateToken, { maxAge: 600, sameSite: 'None' });
  const q = new URLSearchParams({
    client_id: APPLE_WEB_CLIENT_ID,
    redirect_uri: `${appBaseUrl(req)}/auth/web/callback`,
    response_type: 'code id_token',
    response_mode: 'form_post',
    state,
    nonce,
  });
  res.redirect(`https://appleid.apple.com/auth/authorize?${q.toString()}`);
}

async function finishWebSignIn(req, res, queryFn) {
  const cookies = parseCookies(req);
  clearCookie(res, OAUTH_COOKIE, 'None');
  const stateToken = cookies[OAUTH_COOKIE];
  if (!stateToken) {
    res.status(400).type('text/plain').send('Sign-in session expired.');
    return;
  }
  let st;
  try { st = await verifyOauthState(stateToken); }
  catch { res.status(400).type('text/plain').send('Sign-in state invalid.'); return; }
  if (!req.body?.state || req.body.state !== st.state) {
    res.status(400).type('text/plain').send('Sign-in state mismatch.');
    return;
  }
  const idToken = req.body?.id_token;
  if (!idToken) {
    res.status(401).type('text/plain').send('Apple didn\'t return a credential.');
    return;
  }
  let uid;
  try { uid = await verifyAppleIdentityToken(idToken, APPLE_WEB_CLIENT_ID, st.nonce); }
  catch (err) {
    res.status(401).type('text/plain').send('Apple verification failed.');
    return;
  }
  await claimLegacyRowsIfFirstUser(queryFn, uid);
  const session = await signSession(uid);
  setCookie(res, COOKIE, session, { maxAge: SESSION_TTL_S, sameSite: 'Lax' });
  res.redirect('/');
}

async function me(req, res) {
  const uid = await attachSession(req);
  if (!uid) {
    res.status(401).json({ signedIn: false });
    return;
  }
  const fresh = await signSession(uid);
  setCookie(res, COOKIE, fresh, { maxAge: SESSION_TTL_S, sameSite: 'Lax' });
  res.json({ signedIn: true, uid });
}

function logout(req, res) {
  clearCookie(res, COOKIE);
  res.json({ ok: true });
}

module.exports = {
  COOKIE,
  attachSession,
  requireSignedIn,
  startWebSignIn,
  finishWebSignIn,
  me,
  logout,
  verifyAppleIdentityToken,
  claimLegacyRowsIfFirstUser,
};
