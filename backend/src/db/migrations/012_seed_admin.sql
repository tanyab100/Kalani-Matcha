-- Migration 012: Promote admin@nami.com to store_admin role.
-- If the account doesn't exist yet, this is a no-op (safe to run multiple times).
UPDATE customers
SET role = 'store_admin'
WHERE email = 'admin@nami.com';
