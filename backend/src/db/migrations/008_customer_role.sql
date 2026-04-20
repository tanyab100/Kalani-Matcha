-- Add role column to customers for Store_Admin authorization
-- Requirements: 11.3

ALTER TABLE customers ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer'
  CHECK (role IN ('customer', 'store_admin'));
