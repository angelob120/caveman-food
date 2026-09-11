# Caveman Food

A one-page dashboard that tells you what to eat right now. No recipe browsing, no calorie obsession — just "what can I make with what I have?"

## Stack
- **Frontend:** Vanilla HTML/CSS/JS, no build step
- **Backend:** Node.js + Express + node-postgres
- **DB:** PostgreSQL (Railway-managed)
- **Hosting:** Railway

## Dev
```bash
cd backend && npm install
DATABASE_URL=postgres://localhost:5432/caveman node server.js
# Frontend served by backend at http://localhost:3000
```

## Deploy
Pushes to `main` auto-deploy to Railway.

## Docs
- `docs/API.md` — API contract
- `docs/SEED.md` — frontend component contract
- `db/schema.sql` — PostgreSQL schema
