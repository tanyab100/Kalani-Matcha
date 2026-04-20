-- Base schema for matcha ordering app
-- Requirements: 2.1, 5.3, 5.9, 11.1

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Menu items
CREATE TABLE IF NOT EXISTS menu_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  base_price  INTEGER NOT NULL,  -- cents
  category    TEXT NOT NULL CHECK (category IN ('drinks', 'food', 'extras')),
  in_stock    BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customization groups (e.g. "Sweetness Level", "Milk Type")
CREATE TABLE IF NOT EXISTS customization_groups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  required     BOOLEAN NOT NULL DEFAULT false,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

-- Customization options (e.g. "50% sweet", "Oat milk")
CREATE TABLE IF NOT EXISTS customization_options (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customization_group_id UUID NOT NULL REFERENCES customization_groups(id) ON DELETE CASCADE,
  label                  TEXT NOT NULL,
  price_delta            INTEGER NOT NULL DEFAULT 0,  -- cents, can be negative
  sort_order             INTEGER NOT NULL DEFAULT 0
);

-- Pickup time slots
CREATE TABLE IF NOT EXISTS pickup_slots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_time     TIMESTAMPTZ NOT NULL,
  capacity      INTEGER NOT NULL DEFAULT 5,   -- max total item quantity per slot
  used_capacity INTEGER NOT NULL DEFAULT 0,   -- sum of item quantities from confirmed orders
  CONSTRAINT used_capacity_non_negative CHECK (used_capacity >= 0),
  CONSTRAINT used_capacity_within_limit CHECK (used_capacity <= capacity)
);

-- Customers (registered accounts)
CREATE TABLE IF NOT EXISTS customers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Orders
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

CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders (customer_id);
CREATE INDEX IF NOT EXISTS orders_pickup_slot_id_idx ON orders (pickup_slot_id);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC);
