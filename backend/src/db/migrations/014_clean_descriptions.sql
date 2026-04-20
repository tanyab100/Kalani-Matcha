-- Migration 014: Remove "Nami" branding from menu item descriptions

UPDATE menu_items SET description = 'Ceremonial grade matcha with your choice of milk'
WHERE id = 'a1b2c3d4-0001-0001-0001-000000000001';

UPDATE menu_items SET description = 'Ceremonial grade matcha topped with house-made vanilla cold foam'
WHERE id = 'a1b2c3d4-0001-0001-0001-000000000002';

UPDATE menu_items SET description = 'Ceremonial grade matcha with strawberry syrup and house-made whip'
WHERE id = 'a1b2c3d4-0001-0001-0001-000000000003';
