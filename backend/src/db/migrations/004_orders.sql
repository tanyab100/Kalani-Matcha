-- Orders table: ensure all required columns exist
-- Requirements: 5.9, 6.6
-- The orders table was created in 001_base_schema.sql.
-- This migration ensures all columns from the design spec are present
-- and adds any that may be missing in older environments.

CREATE TABLE IF NOT EXISTS orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       UUID REFERENCES customers(id) ON DELETE SET NULL,
  guest_email       TEXT,
  items_snapshot    JSONB NOT NULL,
  subtotal          INTEGER NOT NULL,
  tax               INTEGER NOT NULL,
  tip               INTEGER NOT NULL DEFAULT 0,
  total             INTEGER NOT NULL,
  pickup_slot_id    UUID REFERENCES pickup_slots(id),
  status            TEXT NOT NULL DEFAULT 'received'
                      CHECK (status IN ('pending_payment', 'received', 'preparing', 'ready')),
  payment_method    TEXT NOT NULL DEFAULT 'card'
                      CHECK (payment_method IN ('card', 'venmo')),
  idempotency_key   TEXT UNIQUE NOT NULL,
  payment_intent_id TEXT UNIQUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure tip column exists (may be missing in older environments)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tip INTEGER NOT NULL DEFAULT 0;

-- Ensure payment_intent_id column exists
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_intent_id TEXT;

-- Ensure idempotency_key unique constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_idempotency_key_key'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_idempotency_key_key UNIQUE (idempotency_key);
  END IF;
END $$;

-- Ensure payment_intent_id unique constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_payment_intent_id_key'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_payment_intent_id_key UNIQUE (payment_intent_id);
  END IF;
END $$;

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS orders_customer_id_idx    ON orders (customer_id);
CREATE INDEX IF NOT EXISTS orders_pickup_slot_id_idx ON orders (pickup_slot_id);
CREATE INDEX IF NOT EXISTS orders_created_at_idx     ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_idempotency_key_idx ON orders (idempotency_key);
