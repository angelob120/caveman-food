# Caveman Food — Project State

> **First file any AI/agent should read on entering this project.**
> Source of truth for status, decisions, ownership, and backlog.
> Updated by the manager (Mavis) on every meaningful change.

---

## TL;DR
One-page food dashboard. "What can I eat right now?" killer feature. Vanilla JS frontend, Node/Express backend, PostgreSQL on Railway. V1 scope locked; no scope creep.

---

## Stack (locked)
- **Frontend:** Vanilla HTML + CSS + JS, no build step. Alpine.js via CDN allowed for reactive state if it helps.
- **Backend:** Node.js + Express + node-postgres (`pg`)
- **DB:** PostgreSQL (Railway-managed)
- **Hosting:** Railway (single service serves both API and static frontend)
- **Repo:** https://github.com/angelob120/caveman-food (public)

---

## Current Status
| Workstream | Owner | Status | Notes |
|---|---|---|---|
| Schema | Mavis (manager) | ✅ DONE | `db/schema.sql` — idempotent |
| API contract | Mavis | ✅ DONE | `docs/API.md` |
| Frontend DOM contract | Mavis | ✅ DONE | `docs/SEED.md` |
| Seed data | Agent 1 | ✅ DONE | `db/seed.sql` + `db/seed.js` (3 stores, 35 ingredients, 29 foods) |
| Backend | Agent 2 | ✅ DONE | `backend/*` — all 19 routes + `/api/health` + auto-schema |
| Frontend HTML/CSS | Agent 3 | ✅ DONE | `frontend/index.html`, `frontend/styles.css` (dark theme, mobile-first) |
| Frontend JS (core) | Agent 4 | ✅ DONE | `frontend/js/api.js`, `frontend/js/render.js` (10 API methods, 6 render fns) |
| Frontend JS (interactions) | Agent 5 | ✅ DONE | `frontend/js/modals.js`, `frontend/js/admin.js`, `frontend/js/app.js` |
| Deployment | Agent 6 | ✅ DONE | **Live:** https://caveman-web-production.up.railway.app |

---

## Deployment
- **Live URL:** https://caveman-web-production.up.railway.app
- **Railway project:** `caveman-food` (Angelo Brown's workspace)
- **Postgres:** plugin-managed, internal DNS `postgres.railway.internal`
- **Web service:** `caveman-web` — Node auto-detected via root `package.json`
- **Env vars:** `DATABASE_URL`, `ADMIN_PASSWORD=123`, `PORT=3000`, `NODE_ENV=production`
- **Auto-seed:** on first deploy when `foods` table is empty; disable with `AUTO_SEED=false`
- **Push-to-deploy:** `git push origin main` → Railway rebuilds + restarts

---

## File Ownership Map (DO NOT CROSS)
Each agent owns specific files. Others must read but not modify.

| Agent | Files they OWN (create/modify) |
|---|---|
| Manager (Mavis) | `STATE.md`, `AGENTS.md`, `README.md`, `docs/*`, `db/schema.sql` |
| Agent 1 — DB | `db/seed.sql`, `db/seed.js` |
| Agent 2 — Backend | `backend/package.json`, `backend/server.js`, `backend/db.js`, `backend/middleware/*.js`, `backend/routes/*.js`, `backend/seed-runner.js` |
| Agent 3 — FE HTML/CSS | `frontend/index.html`, `frontend/styles.css` |
| Agent 4 — FE JS core | `frontend/js/api.js`, `frontend/js/render.js` |
| Agent 5 — FE JS interactions | `frontend/js/modals.js`, `frontend/js/admin.js`, `frontend/js/app.js` |
| Agent 6 — DevOps | `railway.toml`, `Procfile`, `.env.example`, `package.json` (root, if needed) |

If you need a file outside your ownership, **read it** but **don't modify**. Tell the manager.

---

## Shared Contracts (read these before touching code)
- `docs/API.md` — exact endpoint contracts, request/response shapes
- `docs/SEED.md` — exact DOM selectors, data attributes, behavior
- `docs/RULES.md` — user-facing rules text (static content)
- `db/schema.sql` — DB schema

These are the **law**. If reality contradicts them, update the doc AND tell the manager. Do not silently diverge.

---

## Changelog
| Date | Change | By |
|---|---|---|
| 2026-09-11 | Repo created, skeleton + contracts written | Mavis |
| 2026-09-11 | Stack locked (vanilla JS, Express, Postgres, Railway) | Mavis |
| 2026-09-11 | STATE.md + AGENTS.md context system added | Mavis |
| 2026-09-11 | Seed data (3 stores, 35 ingredients, 29 foods) | Agent 1 |
| 2026-09-11 | Backend (19 routes, dashboard aggregator) | Agent 2 |
| 2026-09-11 | Frontend HTML + dark theme CSS | Agent 3 |
| 2026-09-11 | Frontend core JS (api + render) | Agent 4 |
| 2026-09-11 | Frontend interactions JS (modals + admin + app) | Agent 5 |
| 2026-09-11 | Railway provisioned, configs committed | Agent 6 |
| 2026-09-11 | Integration fixes (#cf-shop-grand, /api/health) | Mavis |
| 2026-09-11 | Root package.json for Railpack Node detection | Mavis |
| 2026-09-11 | Auto-seed on first deploy | Mavis |
| 2026-09-11 | **Live verified — all 11 smoke checks pass** | Mavis |
| 2026-09-11 | **Daily-use UX redesign** — sticky header + search, hero mini-cards (1-tap MAKE), contained scroll windows, inline archive buttons, ingredient chip picker, floating quick-add, collapsible manage panel, toast notifications | Mavis |
| 2026-09-11 | Backend: `?include_archived=true` (admin) on GET /api/foods | Mavis |
| 2026-09-11 | Frontend interactions JS (modals, admin panel, app entry) | Agent 5 |
| 2026-09-11 | Backend Express API with all routes + dashboard aggregator | Agent 2 |
| 2026-09-11 | Railway project `caveman-food` created; Postgres provisioned; web service scaffolded; config files written (railway.toml, Procfile, .env.example, .gitignore) | Agent 6 |
| 2026-09-11 | Public URL generated: `https://caveman-web-production.up.railway.app` | Agent 6 |

---

## Deployment

**Project:** `caveman-food` on Angelo Brown's Projects (workspace)
**Project ID:** `68e243a3-f0ce-4099-ab6d-ac71bbeedad4`
**Public URL:** https://caveman-web-production.up.railway.app
**Environment:** `production`

**Services:**
| Service | ID | Status | Notes |
|---|---|---|---|
| `Postgres` | `d17641e3-5346-4b2e-9936-3daefe469b4f` | ✅ Running (pg 18) | Volume mounted at `/var/lib/postgresql/data`; auto `DATABASE_URL` |
| `caveman-web` | `ab8721a2-0e37-4f26-9b3c-c8ff9653751b` | ⚠ Build pending | Has healthcheck `/api/health`; needs Agent 2's `package.json` to build |

**Env vars on `caveman-web`:**
- `ADMIN_PASSWORD=123`
- `PORT=3000`
- `NODE_ENV=production`
- `DATABASE_URL=${{Postgres.DATABASE_URL}}` (auto-resolves to Postgres internal URL)

**Open deployment blockers:**
- Build fails with "Railpack could not determine how to build the app" — root has no `package.json`. Agent 2 must add `backend/package.json` (with `express` + `pg` deps and a `start` script). Railpack will then auto-detect Node. Once Agent 2's `backend/server.js` exists, the next `railway up` (or git push to main) will succeed.
| 2026-09-11 | Seed data + runner (`db/seed.sql`, `db/seed.js`, `db/package.json`) | Agent 1 |
| 2026-09-11 | Frontend JS core: `api.js` (10 fetch wrappers on `window.CFApi`) + `render.js` (6 render funcs + `foodCardEl` helper on `window.CFRender`) | Agent 4 |
| 2026-09-11 | Frontend HTML structure (11 sections, 3 modals) + dark-theme CSS — Alpine.js loaded via CDN | Agent 3 |

---

## Backlog (planned, NOT started)
- [ ] **Auth hardening**: replace hardcoded password with bcrypt + env var fallback
- [ ] **Image upload**: replace emoji-only food.image with real image URLs (deferred)
- [ ] **Grocery API integration**: explicitly OUT OF SCOPE for V1
- [ ] **Macro calculator**: explicitly OUT OF SCOPE for V1
- [ ] **Mobile app wrapper**: PWA manifest for "Add to Home Screen"
- [ ] **Notifications**: "Prep day is Sunday" reminder via Railway cron
- [ ] **Multi-user support**: single-user V1; multi-user needs schema rework

---

## Open Questions
None right now. If any agent hits one, add it here and pick a sensible default — do NOT block.

---

## Conventions for AI/Agents
1. **Read STATE.md first.** It's faster than re-reading the repo.
2. **Read the contract doc** for the area you're touching (API.md for backend, SEED.md for frontend, schema.sql for DB).
3. **Don't expand scope.** V1 features only. If you think something needs adding, add it to Backlog above, don't build it.
4. **Update STATE.md when you're done.** Add a Changelog entry: `| 2026-09-11 | <what you did> | <agent name> |`
5. **Commit your work.** Single agent = single commit at the end, message prefixed with `[<agent-id>] <summary>`.
6. **Tests are minimal.** Smoke test only. The manager runs the full e2e check.

---

## How to Update This File
Use Edit (not Write) for small updates. Replace the Changelog table row, add to Backlog, etc. Keep it scannable — under 200 lines if possible.
