-- Migration 013: Add Mango Matcha, Coconut Matcha Americano, and Mango Syrup option

-- ── New menu items ────────────────────────────────────────────────────────────

INSERT INTO menu_items (id, name, description, base_price, category, in_stock) VALUES
  ('a1b2c3d4-0001-0001-0001-000000000004', 'Mango Matcha',
   'Ceremonial grade matcha with fresh mango syrup and your choice of milk', 700, 'drinks', true),
  ('a1b2c3d4-0001-0001-0001-000000000005', 'Coconut Matcha Americano',
   'Ceremonial grade matcha with coconut water and ceremonial grade matcha', 700, 'drinks', true)
ON CONFLICT (id) DO NOTHING;

-- ── Mango Matcha customizations (Milk + Sweetness) ───────────────────────────

INSERT INTO customization_groups (id, menu_item_id, label, required, sort_order) VALUES
  ('b1000004-0001-0001-0001-000000000001', 'a1b2c3d4-0001-0001-0001-000000000004', 'Milk',            true,  1),
  ('b1000004-0001-0001-0001-000000000002', 'a1b2c3d4-0001-0001-0001-000000000004', 'Sweetness Level', true,  2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO customization_options (id, customization_group_id, label, price_delta, sort_order) VALUES
  ('c1000004-0001-0001-0001-000000000001', 'b1000004-0001-0001-0001-000000000001', 'Oat Milk',       0, 1),
  ('c1000004-0001-0001-0001-000000000002', 'b1000004-0001-0001-0001-000000000001', 'Whole Milk',     0, 2),
  ('c1000004-0001-0001-0001-000000000010', 'b1000004-0001-0001-0001-000000000002', '0%',             0, 1),
  ('c1000004-0001-0001-0001-000000000011', 'b1000004-0001-0001-0001-000000000002', '50%',            0, 2),
  ('c1000004-0001-0001-0001-000000000012', 'b1000004-0001-0001-0001-000000000002', '100% (Regular)', 0, 3),
  ('c1000004-0001-0001-0001-000000000013', 'b1000004-0001-0001-0001-000000000002', '150% (Extra)',  50, 4)
ON CONFLICT (id) DO NOTHING;

-- ── Coconut Matcha Americano customizations (Sweetness only) ─────────────────

INSERT INTO customization_groups (id, menu_item_id, label, required, sort_order) VALUES
  ('b1000005-0001-0001-0001-000000000001', 'a1b2c3d4-0001-0001-0001-000000000005', 'Sweetness Level', true, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO customization_options (id, customization_group_id, label, price_delta, sort_order) VALUES
  ('c1000005-0001-0001-0001-000000000010', 'b1000005-0001-0001-0001-000000000001', '0%',             0, 1),
  ('c1000005-0001-0001-0001-000000000011', 'b1000005-0001-0001-0001-000000000001', '50%',            0, 2),
  ('c1000005-0001-0001-0001-000000000012', 'b1000005-0001-0001-0001-000000000001', '100% (Regular)', 0, 3),
  ('c1000005-0001-0001-0001-000000000013', 'b1000005-0001-0001-0001-000000000001', '150% (Extra)',  50, 4)
ON CONFLICT (id) DO NOTHING;

-- ── Add Mango Syrup to Matcha Latte syrup group ───────────────────────────────
-- Matcha Latte syrup group id: b1000001-0001-0001-0001-000000000003

INSERT INTO customization_options (id, customization_group_id, label, price_delta, sort_order) VALUES
  ('c1000001-0001-0001-0001-000000000006', 'b1000001-0001-0001-0001-000000000003', 'Mango Syrup', 0, 4)
ON CONFLICT (id) DO NOTHING;
