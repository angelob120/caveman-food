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
| Seed data | Agent 1 | 🔲 TODO | `db/seed.sql` + `db/seed.js` |
| Backend | Agent 2 | 🔲 TODO | `backend/*` |
| Frontend HTML/CSS | Agent 3 | 🔲 TODO | `frontend/index.html`, `frontend/styles.css` |
| Frontend JS (core) | Agent 4 | 🔲 TODO | `frontend/js/api.js`, `frontend/js/render.js` |
| Frontend JS (interactions) | Agent 5 | 🔲 TODO | `frontend/js/modals.js`, `frontend/js/admin.js`, `frontend/js/app.js` |
| Deployment | Agent 6 | 🔲 TODO | Railway setup + smoke test |

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
