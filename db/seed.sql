-- Caveman Food — seed data (V1)
-- Run after db/schema.sql. Idempotent: safe to re-run.
-- Usage:  psql $DATABASE_URL -f db/seed.sql
--         or: node db/seed.js

BEGIN;

-- ============================================================
-- Stores (idempotent via UNIQUE(name))
-- ============================================================
INSERT INTO stores (name) VALUES
  ('Walmart'),
  ('Aldi'),
  ('Kroger')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- Ingredients (idempotent: skip rows whose name already exists)
-- ============================================================
INSERT INTO ingredients (name, store_id, package_price, package_size, servings_per_package, have)
SELECT ing.name, s.id, ing.package_price, ing.package_size, ing.servings_per_package, ing.have
FROM (VALUES
  ('Chicken Breast',          'Walmart', 12.00, '2 lb',          4.00, TRUE),
  ('Ground Beef',             'Walmart',  8.00, '1 lb',          4.00, TRUE),
  ('Steak (Ribeye)',          'Aldi',    14.00, '1 lb',          2.00, TRUE),
  ('Turkey Slices',           'Walmart',  6.00, '16 slices',     8.00, TRUE),
  ('Tuna (canned)',           'Walmart',  4.00, '5 cans',        5.00, TRUE),
  ('Eggs',                    'Aldi',     4.00, '18 ct',         9.00, TRUE),
  ('Bacon',                   'Aldi',     5.00, '1 lb',          6.00, TRUE),
  ('Sausage',                 'Walmart',  6.00, '1 lb',          4.00, TRUE),
  ('Frozen Chicken Tenders',  'Walmart',  8.00, '2 lb bag',      5.00, TRUE),
  ('Frozen Shrimp',           'Walmart', 10.00, '1 lb',          3.00, TRUE),
  ('Frozen Fish (Ocean Perch)','Walmart', 9.00, '1 lb',          3.00, TRUE),
  ('Frozen Fries',            'Walmart',  3.00, '2 lb bag',      5.00, TRUE),
  ('Frozen Fruit Mix',        'Kroger',   5.00, '2 lb bag',      5.00, TRUE),
  ('Hoagie Rolls',            'Walmart',  3.00, '6 ct',          6.00, TRUE),
  ('Tortillas',               'Walmart',  3.00, '10 ct',        10.00, TRUE),
  ('Bread',                   'Walmart',  3.00, '20 slices',    10.00, TRUE),
  ('Crescent Rolls',          'Walmart',  3.00, '8 ct',          4.00, TRUE),
  ('Cheese (sliced)',         'Walmart',  4.00, '16 slices',     8.00, TRUE),
  ('Cheese (shredded)',       'Walmart',  4.00, '16 oz',         8.00, TRUE),
  ('Pasta',                   'Walmart',  2.00, '1 lb',          4.00, TRUE),
  ('Rice',                    'Walmart',  3.00, '5 lb bag',     20.00, TRUE),
  ('Mac & Cheese',            'Walmart',  2.00, '4 boxes',       4.00, TRUE),
  ('Pizza (frozen)',          'Walmart',  5.00, '1 pizza',       2.00, TRUE),
  ('Chicken Pot Pie (frozen)','Walmart',  4.00, '2 ct',          2.00, TRUE),
  ('Pancake Mix',             'Walmart',  3.00, 'big box',       8.00, TRUE),
  ('Vegetables (mixed frozen)','Walmart', 3.00, '1 lb',          4.00, TRUE),
  ('Peppers (fresh)',         'Walmart',  3.00, '3 ct',          3.00, TRUE),
  ('Onion',                   'Walmart',  2.00, '3 ct',          6.00, TRUE),
  ('Tomato',                  'Walmart',  3.00, '4 ct',          4.00, TRUE),
  ('Lettuce',                 'Walmart',  2.00, '1 head',        4.00, TRUE),
  ('Banana',                  'Walmart',  2.00, '6 ct',          6.00, TRUE),
  ('Apple',                   'Walmart',  3.00, '5 ct',          5.00, TRUE),
  ('Cereal',                  'Walmart',  4.00, 'big box',      12.00, TRUE),
  ('Mayo',                    'Walmart',  4.00, 'big jar',      20.00, TRUE),
  ('Seasoning (general)',     'Walmart',  3.00, 'big jar',      30.00, TRUE)
) AS ing (name, store_name, package_price, package_size, servings_per_package, have)
JOIN stores s ON s.name = ing.store_name
WHERE NOT EXISTS (SELECT 1 FROM ingredients i WHERE i.name = ing.name);

-- ============================================================
-- Foods (idempotent: skip rows whose name already exists)
-- ============================================================
INSERT INTO foods (name, image, food_type, cook_minutes, calories, instructions, instructions_short, meal_prep_compatible, favorite, active)
SELECT f.name, f.image, f.food_type, f.cook_minutes, f.calories, f.instructions, f.instructions_short, f.meal_prep_compatible, FALSE, TRUE
FROM (VALUES
  -- ============ FULL MEALS (food_type='full') ============
  (
    'Philly Cheesesteak',
    '🥩',
    'full',
    25,
    950,
    E'1. Slice the chicken breast into thin strips. Season with salt and pepper.\n2. Heat oil in a skillet over medium-high heat. Cook chicken until browned, about 6-8 minutes.\n3. Remove chicken. Add sliced peppers and onions to the same pan. Cook until soft, about 5 minutes.\n4. Return chicken to the pan. Top with sliced cheese and cover for 1-2 minutes to melt.\n5. Pile onto a hoagie roll. Serve immediately.',
    E'Cook chicken.\nCook peppers & onions.\nAdd cheese on top.\nPut on hoagie roll.\nEat.',
    TRUE
  ),
  (
    'Philly Chicken',
    '🍗',
    'full',
    20,
    850,
    E'1. Slice chicken breast into thin strips.\n2. Cook in oil over medium-high heat until done, about 6 minutes.\n3. Add peppers and onions, cook until soft.\n4. Top with cheese slices, cover to melt.\n5. Serve on hoagie rolls.',
    E'Cook chicken strips.\nCook peppers & onions.\nAdd cheese to melt.\nStuff into hoagie.\nEat.',
    TRUE
  ),
  (
    'Pizza',
    '🍕',
    'full',
    18,
    900,
    E'1. Preheat oven to 425°F.\n2. Remove frozen pizza from box and wrapper.\n3. Place directly on oven rack (or on a baking sheet).\n4. Bake for 14-18 minutes until cheese is bubbly and crust is golden.\n5. Let cool 2 minutes, then slice and eat.',
    E'Preheat oven to 425.\nUnwrap frozen pizza.\nBake 15 min.\nSlice and eat.',
    TRUE
  ),
  (
    'Chicken Pot Pie',
    '🥧',
    'full',
    35,
    850,
    E'1. Preheat oven to 400°F.\n2. Remove pot pies from packaging, place on baking sheet.\n3. Bake for 30-35 minutes until crust is golden brown and filling is bubbling.\n4. Let cool 3 minutes before eating (filling is very hot).',
    E'Preheat to 400.\nPlace pies on sheet.\nBake 30 min.\nCool 3 min.\nEat.',
    FALSE
  ),
  (
    'Fried Chicken',
    '🍗',
    'full',
    30,
    950,
    E'1. Cut chicken breast into strips or pieces.\n2. Season generously with general seasoning.\n3. Heat 1/4 inch of oil in a skillet over medium-high.\n4. Fry chicken pieces 4-5 minutes per side until golden and cooked through.\n5. Drain on paper towels. Serve.',
    E'Slice chicken.\nSeason heavily.\nFry 5 min per side.\nDrain.\nEat.',
    TRUE
  ),
  (
    'Fried Shrimp',
    '🍤',
    'full',
    20,
    700,
    E'1. Thaw frozen shrimp under cool running water (5 min).\n2. Heat oil in a skillet over medium-high heat.\n3. Fry shrimp 2-3 minutes per side until pink and golden.\n4. Drain on paper towels. Serve with seasoning or dipping sauce.',
    E'Thaw shrimp.\nFry 2-3 min per side.\nDrain.\nEat.',
    FALSE
  ),
  (
    'Chicken + Fries',
    '🍗',
    'full',
    18,
    800,
    E'1. Preheat oven to 425°F.\n2. Spread frozen fries on a baking sheet in a single layer.\n3. Bake fries for 12-15 minutes.\n4. Bake frozen chicken tenders alongside (or on a separate sheet) per package directions, usually 13-15 minutes.\n5. Plate and eat.',
    E'Preheat to 425.\nBake fries 12 min.\nBake tenders 13 min.\nPlate and eat.',
    TRUE
  ),
  (
    'Quesadilla',
    '🌮',
    'full',
    10,
    700,
    E'1. Slice chicken breast thin, season and cook in a skillet until done.\n2. Wipe skillet clean. Heat over medium.\n3. Place tortilla in pan, sprinkle cheese, add chicken, more cheese, top with second tortilla.\n4. Cook 2-3 minutes per side until golden and cheese melted.\n5. Slice into wedges.',
    E'Cook chicken.\nLayer cheese + chicken in tortilla.\nCook both sides 2 min.\nSlice and eat.',
    TRUE
  ),
  (
    'Turkey Burger',
    '🍔',
    'full',
    15,
    650,
    E'1. Layer 2 slices of bread with a cheese slice.\n2. Pile turkey slices on top of cheese.\n3. Top with second cheese slice if desired.\n4. Add any extras (lettuce, tomato, mayo).\n5. Close and eat open-face or as a sandwich.',
    E'Layer bread + cheese.\nAdd turkey slices.\nTop with bread.\nEat.',
    FALSE
  ),
  (
    'Chicken Burger',
    '🍔',
    'full',
    15,
    700,
    E'1. Season and cook chicken breast in a skillet 5-6 minutes per side until done.\n2. Toast bread lightly.\n3. Build sandwich: bread, chicken, cheese, bread.\n4. Add mayo or seasoning to taste.',
    E'Cook chicken 6 min per side.\nToast bread.\nLayer chicken + cheese.\nEat.',
    FALSE
  ),
  (
    'Chicken Tenders',
    '🍗',
    'full',
    15,
    600,
    E'1. Preheat oven to 425°F.\n2. Spread frozen chicken tenders on a baking sheet.\n3. Bake 13-15 minutes, flipping halfway, until golden and crispy.\n4. Serve with seasoning or dipping sauce.',
    E'Preheat to 425.\nSpread tenders on sheet.\nBake 13 min, flip, 2 min more.\nEat.',
    TRUE
  ),
  (
    'Ocean Perch',
    '🐟',
    'full',
    20,
    650,
    E'1. Preheat oven to 425°F.\n2. Place frozen fish on a baking sheet, season lightly.\n3. Bake 12-15 minutes until fish flakes easily.\n4. Bake frozen fries on a separate sheet for 12-15 minutes.\n5. Plate fish and fries together.',
    E'Preheat to 425.\nBake fish 12-15 min.\nBake fries same time.\nPlate and eat.',
    FALSE
  ),
  (
    'Spaghetti',
    '🍝',
    'full',
    25,
    800,
    E'1. Bring a pot of salted water to boil.\n2. Brown ground beef in a skillet, breaking it up, about 7 minutes. Drain fat.\n3. (V1: skip sauce — eat as beef pasta or add your own jarred sauce.)\n4. Cook pasta per package directions, usually 8-10 minutes.\n5. Drain pasta, toss with beef. Serve.',
    E'Boil water.\nBrown beef.\nCook pasta 9 min.\nDrain and mix.\nEat.',
    TRUE
  ),
  (
    'Steak + Rice',
    '🥩',
    'full',
    25,
    900,
    E'1. Cook rice per package directions (or use a rice cooker).\n2. Season steak with salt and pepper.\n3. Heat a cast-iron or heavy skillet over high heat until very hot.\n4. Sear steak 3-4 minutes per side for medium-rare (adjust for thickness).\n5. Rest steak 3 minutes. Slice against the grain. Serve over rice.',
    E'Cook rice.\nSear steak 3-4 min per side.\nRest 3 min.\nSlice and serve over rice.',
    TRUE
  ),
  (
    'Chicken + Rice',
    '🍗',
    'full',
    25,
    750,
    E'1. Cook rice per package directions.\n2. Season chicken breast with seasoning.\n3. Cook in a skillet over medium-high heat 5-6 minutes per side until done (internal 165°F).\n4. Slice chicken. Serve over rice with extra seasoning.',
    E'Cook rice.\nCook chicken 6 min per side.\nSlice over rice.\nEat.',
    TRUE
  ),
  (
    'Mac & Cheese + Meat',
    '🧀',
    'full',
    20,
    800,
    E'1. Brown ground beef in a skillet, about 7 minutes. Drain fat. Set aside.\n2. Boil water, cook mac & cheese per box directions (usually 8 minutes).\n3. Drain pasta, add cheese packet, stir.\n4. Plate mac & cheese, top with beef.',
    E'Brown beef 7 min.\nBoil + cook mac 8 min.\nMix in cheese.\nTop with beef.',
    TRUE
  ),
  (
    'Sausage + Sides',
    '🌭',
    'full',
    20,
    850,
    E'1. Cook mixed frozen vegetables per bag directions (microwave or stovetop).\n2. Slice sausage links or rounds.\n3. Brown sausage in a skillet over medium-high heat, about 5-7 minutes.\n4. Plate sausage with vegetables on the side.',
    E'Cook vegetables per bag.\nBrown sausage 7 min.\nPlate together.\nEat.',
    TRUE
  ),
  (
    'Salad + Chicken',
    '🥗',
    'full',
    15,
    500,
    E'1. Season and cook chicken breast in a skillet 5-6 minutes per side until done.\n2. Chop lettuce, tomato.\n3. Slice cooked chicken.\n4. Toss greens with shredded cheese, top with sliced chicken and tomato.\n5. Add dressing or seasoning.',
    E'Cook chicken 6 min per side.\nChop lettuce + tomato.\nTop with chicken + cheese.\nEat.',
    FALSE
  ),
  (
    'Pancakes + Bacon',
    '🥞',
    'full',
    15,
    700,
    E'1. Cook bacon in a skillet over medium heat 3-4 minutes per side until crispy. Set aside.\n2. Mix pancake batter per box directions.\n3. Pour 1/4 cup batter per pancake onto a hot greased skillet.\n4. Flip when bubbles form, cook 1-2 minutes more.\n5. Serve pancakes with bacon on the side.',
    E'Cook bacon 4 min per side.\nPour pancakes.\nFlip when bubbly.\nServe with bacon.',
    FALSE
  ),
  -- ============ QUICK MEALS (food_type='quick') ============
  (
    'Tuna + Mayo Sandwich',
    '🥪',
    'quick',
    5,
    500,
    E'1. Drain tuna cans into a bowl.\n2. Mix in a few spoonfuls of mayo until creamy.\n3. Spread tuna mixture on a slice of bread.\n4. Top with second slice. Cut in half.',
    E'Mix tuna + mayo.\nSpread on bread.\nTop with second slice.\nEat.',
    FALSE
  ),
  (
    'Egg + Turkey + Cheese Crescent',
    '🥐',
    'quick',
    8,
    450,
    E'1. Scramble or fry an egg in a small skillet.\n2. Open crescent roll can, separate triangles.\n3. Layer turkey slices and cheese slice on each triangle.\n4. Add cooked egg.\n5. Roll up and bake per crescent package directions (usually 10-12 min at 375°F).',
    E'Cook egg.\nLayer turkey + cheese on crescent.\nRoll up.\nBake 10 min.\nEat.',
    TRUE
  ),
  (
    'Eggs + Toast',
    '🍳',
    'quick',
    8,
    400,
    E'1. Toast 2 slices of bread.\n2. While toasting, fry 2 eggs in a skillet over medium heat (3-4 minutes).\n3. Plate toast, top with eggs.\n4. Salt and pepper to taste.',
    E'Toast bread.\nFry 2 eggs.\nTop toast with eggs.\nEat.',
    FALSE
  ),
  (
    'Cereal',
    '🥣',
    'quick',
    3,
    300,
    E'1. Pour cereal into a bowl.\n2. Add milk (not seeded in V1, use your own).\n3. Eat.',
    E'Pour cereal.\nAdd milk.\nEat.',
    FALSE
  ),
  (
    'Turkey Sandwich',
    '🥪',
    'quick',
    5,
    450,
    E'1. Lay 2 slices of bread on a plate.\n2. Add a cheese slice to one slice.\n3. Pile turkey slices on the cheese.\n4. Add mayo if desired.\n5. Close sandwich, cut in half.',
    E'Bread + cheese + turkey.\nAdd mayo.\nClose and cut.\nEat.',
    FALSE
  ),
  (
    'Chicken Sandwich',
    '🥪',
    'quick',
    10,
    550,
    E'1. Season chicken breast. Cook in skillet 5-6 minutes per side.\n2. Toast bread lightly.\n3. Layer: bread, chicken, cheese, bread.\n4. Add mayo or seasoning. Serve.',
    E'Cook chicken 6 min per side.\nToast bread.\nLayer chicken + cheese.\nEat.',
    FALSE
  ),
  -- ============ SNACKS (food_type='snack') ============
  (
    'Frozen Fruit Smoothie',
    '🥤',
    'snack',
    5,
    250,
    E'1. Pour frozen fruit mix into a blender.\n2. Add a splash of water, milk, or juice (not seeded).\n3. Blend until smooth, about 30 seconds.\n4. Pour into a glass and drink.',
    E'Blend frozen fruit + liquid.\nPour.\nDrink.',
    FALSE
  ),
  (
    'Half Sandwich',
    '🥪',
    'snack',
    3,
    250,
    E'1. Take 1 slice of bread.\n2. Add half a cheese slice and 2-3 turkey slices.\n3. Fold bread over. Eat.',
    E'Bread + cheese + turkey.\nFold.\nEat.',
    FALSE
  ),
  (
    'Fruit',
    '🍎',
    'snack',
    1,
    150,
    E'1. Wash an apple.\n2. Peel a banana.\n3. Eat.',
    E'Wash apple.\nPeel banana.\nEat.',
    FALSE
  ),
  (
    'Leftover Meal-Prep Box',
    '📦',
    'snack',
    3,
    700,
    E'1. Pull a meal-prep box from the fridge.\n2. Microwave 2-3 minutes until heated through.\n3. Eat straight from the box.',
    E'Microwave box 2-3 min.\nEat.',
    TRUE
  )
) AS f (name, image, food_type, cook_minutes, calories, instructions, instructions_short, meal_prep_compatible)
WHERE NOT EXISTS (SELECT 1 FROM foods fd WHERE fd.name = f.name);

-- ============================================================
-- Food ↔ Ingredient links (idempotent via UNIQUE(food_id, ingredient_id))
-- ============================================================
INSERT INTO food_ingredients (food_id, ingredient_id)
SELECT fd.id, i.id
FROM (VALUES
  -- Philly Cheesesteak
  ('Philly Cheesesteak', 'Chicken Breast'),
  ('Philly Cheesesteak', 'Peppers (fresh)'),
  ('Philly Cheesesteak', 'Onion'),
  ('Philly Cheesesteak', 'Cheese (sliced)'),
  ('Philly Cheesesteak', 'Hoagie Rolls'),
  -- Philly Chicken
  ('Philly Chicken', 'Chicken Breast'),
  ('Philly Chicken', 'Peppers (fresh)'),
  ('Philly Chicken', 'Onion'),
  ('Philly Chicken', 'Cheese (sliced)'),
  ('Philly Chicken', 'Hoagie Rolls'),
  -- Pizza
  ('Pizza', 'Pizza (frozen)'),
  -- Chicken Pot Pie
  ('Chicken Pot Pie', 'Chicken Pot Pie (frozen)'),
  -- Fried Chicken
  ('Fried Chicken', 'Chicken Breast'),
  ('Fried Chicken', 'Seasoning (general)'),
  -- Fried Shrimp
  ('Fried Shrimp', 'Frozen Shrimp'),
  -- Chicken + Fries
  ('Chicken + Fries', 'Frozen Chicken Tenders'),
  ('Chicken + Fries', 'Frozen Fries'),
  -- Quesadilla
  ('Quesadilla', 'Chicken Breast'),
  ('Quesadilla', 'Cheese (shredded)'),
  ('Quesadilla', 'Tortillas'),
  -- Turkey Burger
  ('Turkey Burger', 'Turkey Slices'),
  ('Turkey Burger', 'Bread'),
  ('Turkey Burger', 'Cheese (sliced)'),
  -- Chicken Burger
  ('Chicken Burger', 'Chicken Breast'),
  ('Chicken Burger', 'Bread'),
  ('Chicken Burger', 'Cheese (sliced)'),
  -- Chicken Tenders
  ('Chicken Tenders', 'Frozen Chicken Tenders'),
  -- Ocean Perch
  ('Ocean Perch', 'Frozen Fish (Ocean Perch)'),
  ('Ocean Perch', 'Frozen Fries'),
  -- Spaghetti
  ('Spaghetti', 'Pasta'),
  ('Spaghetti', 'Ground Beef'),
  -- Steak + Rice
  ('Steak + Rice', 'Steak (Ribeye)'),
  ('Steak + Rice', 'Rice'),
  -- Chicken + Rice
  ('Chicken + Rice', 'Chicken Breast'),
  ('Chicken + Rice', 'Rice'),
  -- Mac & Cheese + Meat
  ('Mac & Cheese + Meat', 'Mac & Cheese'),
  ('Mac & Cheese + Meat', 'Ground Beef'),
  -- Sausage + Sides
  ('Sausage + Sides', 'Sausage'),
  ('Sausage + Sides', 'Vegetables (mixed frozen)'),
  -- Salad + Chicken
  ('Salad + Chicken', 'Chicken Breast'),
  ('Salad + Chicken', 'Lettuce'),
  ('Salad + Chicken', 'Tomato'),
  ('Salad + Chicken', 'Cheese (shredded)'),
  -- Pancakes + Bacon
  ('Pancakes + Bacon', 'Pancake Mix'),
  ('Pancakes + Bacon', 'Bacon'),
  -- Tuna + Mayo Sandwich
  ('Tuna + Mayo Sandwich', 'Tuna (canned)'),
  ('Tuna + Mayo Sandwich', 'Mayo'),
  ('Tuna + Mayo Sandwich', 'Bread'),
  -- Egg + Turkey + Cheese Crescent
  ('Egg + Turkey + Cheese Crescent', 'Eggs'),
  ('Egg + Turkey + Cheese Crescent', 'Turkey Slices'),
  ('Egg + Turkey + Cheese Crescent', 'Cheese (sliced)'),
  ('Egg + Turkey + Cheese Crescent', 'Crescent Rolls'),
  -- Eggs + Toast
  ('Eggs + Toast', 'Eggs'),
  ('Eggs + Toast', 'Bread'),
  -- Cereal
  ('Cereal', 'Cereal'),
  -- Turkey Sandwich
  ('Turkey Sandwich', 'Turkey Slices'),
  ('Turkey Sandwich', 'Bread'),
  ('Turkey Sandwich', 'Cheese (sliced)'),
  -- Chicken Sandwich
  ('Chicken Sandwich', 'Chicken Breast'),
  ('Chicken Sandwich', 'Bread'),
  ('Chicken Sandwich', 'Cheese (sliced)'),
  -- Frozen Fruit Smoothie
  ('Frozen Fruit Smoothie', 'Frozen Fruit Mix'),
  -- Half Sandwich
  ('Half Sandwich', 'Bread'),
  ('Half Sandwich', 'Cheese (sliced)'),
  ('Half Sandwich', 'Turkey Slices'),
  -- Fruit
  ('Fruit', 'Apple'),
  ('Fruit', 'Banana')
  -- Leftover Meal-Prep Box: no ingredients (prepped food stands alone)
) AS m (food_name, ingredient_name)
JOIN foods fd ON fd.name = m.food_name
JOIN ingredients i ON i.name = m.ingredient_name
ON CONFLICT (food_id, ingredient_id) DO NOTHING;

COMMIT;
