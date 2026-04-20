-- Menu seed data for Nami Matcha
-- Requirements: 2.1
-- All prices in cents. Uses INSERT ... ON CONFLICT DO NOTHING for idempotency.
-- No temperature options (iced only). Sweetness: 0%, 50%, 100% Regular, 150% Extra (+$0.50).

-- ============================================================
-- MENU ITEMS
-- ============================================================

INSERT INTO menu_items (id, name, description, base_price, category, in_stock) VALUES
  ('a1b2c3d4-0001-0001-0001-000000000001', 'Matcha Latte',            'Ceremonial grade matcha with your choice of milk',             600, 'drinks', true),
  ('a1b2c3d4-0001-0001-0001-000000000002', 'Matcha Einspanner',       'Ceremonial grad matcha topped with house-made vanilla cold foam',        700, 'drinks', true),
  ('a1b2c3d4-0001-0001-0001-000000000003', 'Strawberry Cloud Matcha', 'Ceremonial grade matcha with strawberry syrup and house-made whip',       700, 'drinks', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO menu_items (id, name, description, base_price, category, in_stock) VALUES
  ('a1b2c3d4-0001-0001-0001-000000000020', 'Cold Foam Add-on', 'House-made cold foam added to any drink', 100, 'extras', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- CUSTOMIZATION GROUPS & OPTIONS
-- ============================================================

-- ---- Matcha Latte ----
-- Groups: Milk (required), Sweetness (required), Syrup (optional)

INSERT INTO customization_groups (id, menu_item_id, label, required, sort_order) VALUES
  ('b1000001-0001-0001-0001-000000000001', 'a1b2c3d4-0001-0001-0001-000000000001', 'Milk',             true,  1),
  ('b1000001-0001-0001-0001-000000000002', 'a1b2c3d4-0001-0001-0001-000000000001', 'Sweetness Level',  true,  2),
  ('b1000001-0001-0001-0001-000000000003', 'a1b2c3d4-0001-0001-0001-000000000001', 'Syrup',            false, 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO customization_options (id, customization_group_id, label, price_delta, sort_order) VALUES
  -- Milk
  ('c1000001-0001-0001-0001-000000000001', 'b1000001-0001-0001-0001-000000000001', 'Oat Milk',        0, 1),
  ('c1000001-0001-0001-0001-000000000002', 'b1000001-0001-0001-0001-000000000001', 'Whole Milk',      0, 2),
  -- Sweetness
  ('c1000001-0001-0001-0001-000000000010', 'b1000001-0001-0001-0001-000000000002', '0%',              0, 1),
  ('c1000001-0001-0001-0001-000000000011', 'b1000001-0001-0001-0001-000000000002', '50%',             0, 2),
  ('c1000001-0001-0001-0001-000000000012', 'b1000001-0001-0001-0001-000000000002', '100% (Regular)',  0, 3),
  ('c1000001-0001-0001-0001-000000000013', 'b1000001-0001-0001-0001-000000000002', '150% (Extra)',   50, 4),
  -- Syrup
  ('c1000001-0001-0001-0001-000000000003', 'b1000001-0001-0001-0001-000000000003', 'No Syrup',        0, 1),
  ('c1000001-0001-0001-0001-000000000004', 'b1000001-0001-0001-0001-000000000003', 'Simple Syrup',    0, 2),
  ('c1000001-0001-0001-0001-000000000005', 'b1000001-0001-0001-0001-000000000003', 'Strawberry Syrup',0, 3)
ON CONFLICT (id) DO NOTHING;

-- ---- Matcha Einspanner ----
-- Groups: Milk (required), Sweetness (required), Syrup (optional)
-- Cold foam is included in the base price

INSERT INTO customization_groups (id, menu_item_id, label, required, sort_order) VALUES
  ('b1000002-0001-0001-0001-000000000001', 'a1b2c3d4-0001-0001-0001-000000000002', 'Milk',            true,  1),
  ('b1000002-0001-0001-0001-000000000002', 'a1b2c3d4-0001-0001-0001-000000000002', 'Sweetness Level', true,  2),
  ('b1000002-0001-0001-0001-000000000003', 'a1b2c3d4-0001-0001-0001-000000000002', 'Syrup',           false, 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO customization_options (id, customization_group_id, label, price_delta, sort_order) VALUES
  -- Milk
  ('c1000002-0001-0001-0001-000000000001', 'b1000002-0001-0001-0001-000000000001', 'Oat Milk',        0, 1),
  ('c1000002-0001-0001-0001-000000000002', 'b1000002-0001-0001-0001-000000000001', 'Whole Milk',      0, 2),
  -- Sweetness
  ('c1000002-0001-0001-0001-000000000010', 'b1000002-0001-0001-0001-000000000002', '0%',              0, 1),
  ('c1000002-0001-0001-0001-000000000011', 'b1000002-0001-0001-0001-000000000002', '50%',             0, 2),
  ('c1000002-0001-0001-0001-000000000012', 'b1000002-0001-0001-0001-000000000002', '100% (Regular)',  0, 3),
  ('c1000002-0001-0001-0001-000000000013', 'b1000002-0001-0001-0001-000000000002', '150% (Extra)',   50, 4),
  -- Syrup
  ('c1000002-0001-0001-0001-000000000003', 'b1000002-0001-0001-0001-000000000003', 'No Syrup',        0, 1),
  ('c1000002-0001-0001-0001-000000000004', 'b1000002-0001-0001-0001-000000000003', 'Simple Syrup',    0, 2),
  ('c1000002-0001-0001-0001-000000000005', 'b1000002-0001-0001-0001-000000000003', 'Strawberry Syrup',0, 3)
ON CONFLICT (id) DO NOTHING;

-- ---- Strawberry Cloud Matcha ----
-- Groups: Milk (required), Sweetness (required)
-- Strawberry syrup and whip are included; no syrup choice needed

INSERT INTO customization_groups (id, menu_item_id, label, required, sort_order) VALUES
  ('b1000003-0001-0001-0001-000000000001', 'a1b2c3d4-0001-0001-0001-000000000003', 'Milk',            true, 1),
  ('b1000003-0001-0001-0001-000000000002', 'a1b2c3d4-0001-0001-0001-000000000003', 'Sweetness Level', true, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO customization_options (id, customization_group_id, label, price_delta, sort_order) VALUES
  -- Milk
  ('c1000003-0001-0001-0001-000000000001', 'b1000003-0001-0001-0001-000000000001', 'Oat Milk',        0, 1),
  ('c1000003-0001-0001-0001-000000000002', 'b1000003-0001-0001-0001-000000000001', 'Whole Milk',      0, 2),
  -- Sweetness
  ('c1000003-0001-0001-0001-000000000010', 'b1000003-0001-0001-0001-000000000002', '0%',              0, 1),
  ('c1000003-0001-0001-0001-000000000011', 'b1000003-0001-0001-0001-000000000002', '50%',             0, 2),
  ('c1000003-0001-0001-0001-000000000012', 'b1000003-0001-0001-0001-000000000002', '100% (Regular)',  0, 3),
  ('c1000003-0001-0001-0001-000000000013', 'b1000003-0001-0001-0001-000000000002', '150% (Extra)',   50, 4)
ON CONFLICT (id) DO NOTHING;
