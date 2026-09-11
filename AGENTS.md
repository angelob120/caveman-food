# AGENTS.md — Onboarding for any AI/agent joining Caveman Food

> **Read order:** `STATE.md` → this file → the contract doc for your area (`docs/API.md`, `docs/SEED.md`, or `db/schema.sql`) → your assigned files.

## Context-saving rule
- **Read STATE.md and the relevant contract doc instead of re-exploring the repo.**
- If you're delegated a task, the parent agent should have given you a focused scope. Stick to it.
- Don't read files outside your ownership unless you need to confirm a contract.

## Project at a glance
A one-page food dashboard. Tech: vanilla JS frontend, Express + PostgreSQL backend, Railway hosting. Repo: `/Users/ab/Downloads/Code Projects/food app`.

## Working directory
`/Users/ab/Downloads/Code Projects/food app`

## How to run locally
```bash
cd backend && npm install
DATABASE_URL=postgres://localhost:5432/caveman node server.js
# Open http://localhost:3000
```

## Critical files
- `STATE.md` — single source of truth for project status, ownership, backlog
- `docs/API.md` — backend API contract (READ before backend work)
- `docs/SEED.md` — frontend DOM contract (READ before frontend work)
- `db/schema.sql` — DB schema (READ before any DB work)

## V1 scope (do NOT exceed)
✅ One-page dashboard · food cards · cost · store · ingredients · simple instructions · HAVE/OUT inventory · shopping list with totals · store grouping · prep counter · random "I don't know what to eat" button · weekly + monthly stats · admin password 123 · add/edit/remove food · add ingredients + stores · edit targets

❌ NO barcode scan · NO grocery delivery · NO AI meal gen · NO macro calc · NO weight tracking · NO recipe scraping · NO Walmart API · NO nutrition dashboards · NO pantry quantity tracking · NO 100 categories

## Code style
- Plain JS, no TypeScript
- Plain CSS, no Tailwind/PostCSS
- Express + `pg` only on backend (no ORM)
- 2-space indent
- Single-quote strings, semicolons off (modern JS)
- Async/await, not callbacks
