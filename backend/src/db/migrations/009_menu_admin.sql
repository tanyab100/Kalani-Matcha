-- Migration 009: Add hidden and archived columns to menu_items
-- Requirements: 5.2, 5.3, 6.2, 6.3, 11.1, 11.2

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS hidden   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

-- Index for the common public menu filter
CREATE INDEX IF NOT EXISTS menu_items_visible_idx
  ON menu_items (hidden, archived)
  WHERE hidden = false AND archived = false;
