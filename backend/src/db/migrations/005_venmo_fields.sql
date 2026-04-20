-- Add Venmo-specific fields and admin audit log to orders
-- payment_reference: the memo text shown to the customer (e.g. order short ID)
-- payment_confirmed_at: timestamp when Store_Admin confirmed Venmo payment
-- payment_confirmed_by: identifier of the admin who confirmed (x-admin-key prefix or future user ID)

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_confirmed_by TEXT;

-- Backfill payment_reference for existing Venmo orders using short order ID
UPDATE orders
SET payment_reference = 'Order ' || UPPER(SUBSTRING(id::text, 1, 8))
WHERE payment_method = 'venmo' AND payment_reference IS NULL;
