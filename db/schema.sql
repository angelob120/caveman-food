-- Caveman Food — PostgreSQL schema (V1)
-- Run with: psql $DATABASE_URL -f db/schema.sql
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS stores (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stores_user ON stores(user_id);

CREATE TABLE IF NOT EXISTS ingredients (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
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
CREATE INDEX IF NOT EXISTS idx_ingredients_user ON ingredients(user_id);

CREATE TABLE IF NOT EXISTS foods (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
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
CREATE INDEX IF NOT EXISTS idx_foods_user ON foods(user_id);

CREATE TABLE IF NOT EXISTS food_ingredients (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  food_id INT NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  ingredient_id INT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  UNIQUE(food_id, ingredient_id)
);
CREATE INDEX IF NOT EXISTS idx_fi_food ON food_ingredients(food_id);
CREATE INDEX IF NOT EXISTS idx_fi_ingredient ON food_ingredients(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_fi_user ON food_ingredients(user_id);

CREATE TABLE IF NOT EXISTS prep_inventory (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  food_id INT NOT NULL UNIQUE REFERENCES foods(id) ON DELETE CASCADE,
  boxes_remaining INT NOT NULL DEFAULT 0,
  date_prepared DATE
);
CREATE INDEX IF NOT EXISTS idx_prep_user ON prep_inventory(user_id);

CREATE TABLE IF NOT EXISTS shopping_list (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  ingredient_id INT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  price NUMERIC(8,2),
  purchased BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Per-user uniqueness so the same ingredient can be on two users' lists.
  UNIQUE(user_id, ingredient_id, purchased)
);
CREATE INDEX IF NOT EXISTS idx_shopping_purchased ON shopping_list(purchased);
CREATE INDEX IF NOT EXISTS idx_shopping_user ON shopping_list(user_id);

CREATE TABLE IF NOT EXISTS food_log (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  food_id INT REFERENCES foods(id) ON DELETE SET NULL,
  label TEXT,                             -- override for "eating out" etc.
  source TEXT NOT NULL CHECK (source IN ('home','restaurant','prepped')),
  cost NUMERIC(8,2) NOT NULL DEFAULT 0,
  eaten_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_food_log_eaten ON food_log(eaten_at);
CREATE INDEX IF NOT EXISTS idx_food_log_user ON food_log(user_id);

CREATE TABLE IF NOT EXISTS settings (
  user_id TEXT NOT NULL DEFAULT '',
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);

-- Idempotent column additions for pre-multi-tenant databases. After this
-- runs once, every table has user_id with a default of ''. Existing rows
-- keep user_id='' until the first Apple user signs in and claims them.
DO $$
BEGIN
  ALTER TABLE stores          ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
  ALTER TABLE ingredients     ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
  ALTER TABLE foods           ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
  ALTER TABLE food_ingredients ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
  ALTER TABLE prep_inventory  ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
  ALTER TABLE shopping_list   ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
  ALTER TABLE food_log        ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN others THEN null; END $$;

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_stores_user ON stores(user_id);
  CREATE INDEX IF NOT EXISTS idx_ingredients_user ON ingredients(user_id);
  CREATE INDEX IF NOT EXISTS idx_foods_user ON foods(user_id);
  CREATE INDEX IF NOT EXISTS idx_fi_user ON food_ingredients(user_id);
  CREATE INDEX IF NOT EXISTS idx_prep_user ON prep_inventory(user_id);
  CREATE INDEX IF NOT EXISTS idx_shopping_user ON shopping_list(user_id);
  CREATE INDEX IF NOT EXISTS idx_food_log_user ON food_log(user_id);
EXCEPTION WHEN others THEN null; END $$;

-- Rebuild settings PK to include user_id.
DO $$
BEGIN
  ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey;
EXCEPTION WHEN others THEN null; END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'settings_pkey') THEN
    ALTER TABLE settings ADD PRIMARY KEY (user_id, key);
  END IF;
EXCEPTION WHEN others THEN null; END $$;

-- Rebuild shopping_list UNIQUE so two users can each have an unpurchased
-- entry for the same ingredient.
DO $$
BEGIN
  ALTER TABLE shopping_list DROP CONSTRAINT IF EXISTS shopping_list_ingredient_id_purchased_key;
EXCEPTION WHEN others THEN null; END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shopping_list_user_ing_purch_key')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shopping_list')
  THEN
    BEGIN
      ALTER TABLE shopping_list ADD CONSTRAINT shopping_list_user_ing_purch_key UNIQUE (user_id, ingredient_id, purchased);
    EXCEPTION WHEN others THEN null; END;
  END IF;
END $$;

-- Rebuild stores UNIQUE: per-user store name uniqueness (was global).
DO $$
BEGIN
  ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_name_key;
EXCEPTION WHEN others THEN null; END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stores_user_name_key')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stores')
  THEN
    BEGIN
      ALTER TABLE stores ADD CONSTRAINT stores_user_name_key UNIQUE (user_id, name);
    EXCEPTION WHEN others THEN null; END;
  END IF;
END $$;

-- Rebuild food_ingredients UNIQUE: per-user link uniqueness.
DO $$
BEGIN
  ALTER TABLE food_ingredients DROP CONSTRAINT IF EXISTS food_ingredients_food_id_ingredient_id_key;
EXCEPTION WHEN others THEN null; END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'food_ingredients_user_food_ing_key')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'food_ingredients')
  THEN
    BEGIN
      ALTER TABLE food_ingredients ADD CONSTRAINT food_ingredients_user_food_ing_key UNIQUE (user_id, food_id, ingredient_id);
    EXCEPTION WHEN others THEN null; END;
  END IF;
END $$;

-- Rebuild prep_inventory UNIQUE: per-user food → one prep row.
DO $$
BEGIN
  ALTER TABLE prep_inventory DROP CONSTRAINT IF EXISTS prep_inventory_food_id_key;
EXCEPTION WHEN others THEN null; END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prep_inventory_user_food_key')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prep_inventory')
  THEN
    BEGIN
      ALTER TABLE prep_inventory ADD CONSTRAINT prep_inventory_user_food_key UNIQUE (user_id, food_id);
    EXCEPTION WHEN others THEN null; END;
  END IF;
END $$;
