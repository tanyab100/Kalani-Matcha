-- Migration 011: Remove the "No Cold Foam" option from the Matcha Latte cold foam group
DELETE FROM customization_options
WHERE id = 'c1000001-0001-0001-0001-000000000020';
