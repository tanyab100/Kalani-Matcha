-- Migration 010: Archive the Cold Foam Add-on extras item and add Cold Foam
-- as an optional customization on the Matcha Latte.

-- Archive the standalone Cold Foam Add-on so it no longer appears on the public menu
UPDATE menu_items
SET archived = true
WHERE id = 'a1b2c3d4-0001-0001-0001-000000000020';

-- Add a "Cold Foam" optional customization group to the Matcha Latte (sort_order 4, after Syrup)
INSERT INTO customization_groups (id, menu_item_id, label, required, sort_order)
VALUES (
  'b1000001-0001-0001-0001-000000000004',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'Cold Foam',
  false,
  4
)
ON CONFLICT (id) DO NOTHING;

-- Options: Add Cold Foam (+$1.00)
INSERT INTO customization_options (id, customization_group_id, label, price_delta, sort_order)
VALUES
  ('c1000001-0001-0001-0001-000000000021', 'b1000001-0001-0001-0001-000000000004', 'Add Cold Foam', 100, 1)
ON CONFLICT (id) DO NOTHING;
