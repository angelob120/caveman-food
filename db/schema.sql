-- Caveman Food — PostgreSQL schema (V1)
-- Run with: psql $DATABASE_URL -f db/schema.sql
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS stores (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ingredients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  store_id INT REFERENCES stores(id) ON DELETE SET NULL,
  package_price NUMERIC(8,2),           -- e.g. 12.00
  package_size TEXT,                      -- e.g. "2 lb", "12 ct"
  servings_per_package NUMERIC(6,2),      -- e.g. 4
  -- Estimated meal cost is derived: package_price / servings_per_package
  have BOOLEAN NOT NULL DEFAULT TRUE,     -- HAVE / OUT (no quantity tracking)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients(name);
CREATE INDEX IF NOT EXISTS idx_ingredients_store ON ingredients(store_id);

CREATE TABLE IF NOT EXISTS foods (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  image TEXT,                             -- emoji or url
  food_type TEXT NOT NULL CHECK (food_type IN ('full','quick','snack','prepped')),
  cook_minutes INT NOT NULL DEFAULT 0,
  calories INT,
  instructions TEXT NOT NULL,             -- newline-separated steps
  instructions_short TEXT,                -- 3-5 step compact version
  meal_prep_compatible BOOLEAN NOT NULL DEFAULT FALSE,
  favorite BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_foods_active ON foods(active);

CREATE TABLE IF NOT EXISTS food_ingredients (
  id SERIAL PRIMARY KEY,
  food_id INT NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  ingredient_id INT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  UNIQUE(food_id, ingredient_id)
);
CREATE INDEX IF NOT EXISTS idx_fi_food ON food_ingredients(food_id);
CREATE INDEX IF NOT EXISTS idx_fi_ingredient ON food_ingredients(ingredient_id);

CREATE TABLE IF NOT EXISTS prep_inventory (
  id SERIAL PRIMARY KEY,
  food_id INT NOT NULL UNIQUE REFERENCES foods(id) ON DELETE CASCADE,
  boxes_remaining INT NOT NULL DEFAULT 0,
  date_prepared DATE
);

CREATE TABLE IF NOT EXISTS shopping_list (
  id SERIAL PRIMARY KEY,
  ingredient_id INT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  price NUMERIC(8,2),
  purchased BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ingredient_id, purchased)
);
CREATE INDEX IF NOT EXISTS idx_shopping_purchased ON shopping_list(purchased);

CREATE TABLE IF NOT EXISTS food_log (
  id SERIAL PRIMARY KEY,
  food_id INT REFERENCES foods(id) ON DELETE SET NULL,
  label TEXT,                             -- override for "eating out" etc.
  source TEXT NOT NULL CHECK (source IN ('home','restaurant','prepped')),
  cost NUMERIC(8,2) NOT NULL DEFAULT 0,
  eaten_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_food_log_eaten ON food_log(eaten_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Seed default settings (idempotent)
INSERT INTO settings(key,value) VALUES
  ('admin_password','123'),
  ('full_prep_target','10'),
  ('snack_prep_target','5'),
  ('monthly_food_target','400')
ON CONFLICT (key) DO NOTHING;
