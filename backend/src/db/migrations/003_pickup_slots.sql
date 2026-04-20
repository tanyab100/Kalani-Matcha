-- Pickup slots: ensure capacity columns exist and seed development data
-- Requirements: 11.1, 5.3

-- Add capacity columns if they don't already exist (idempotent for environments
-- that ran 001_base_schema.sql before these columns were added)
ALTER TABLE pickup_slots
  ADD COLUMN IF NOT EXISTS capacity      INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS used_capacity INTEGER NOT NULL DEFAULT 0;

-- Constraints (safe to add; will error only if they already exist under a different name,
-- so we use DO $$ blocks to swallow duplicate-constraint errors)
DO $$
BEGIN
  ALTER TABLE pickup_slots
    ADD CONSTRAINT used_capacity_non_negative CHECK (used_capacity >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE pickup_slots
    ADD CONSTRAINT used_capacity_within_limit CHECK (used_capacity <= capacity);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- SEED: pickup slots for development
-- Slots every 15 minutes from 09:00 to 17:00 for the next 7 days
-- Uses INSERT ... ON CONFLICT DO NOTHING for idempotency
-- ============================================================

-- We generate slots using generate_series so the seed is self-contained SQL.
-- Slots are anchored to the current date at migration time (date_trunc('day', now())).
-- Each slot gets a deterministic UUID derived from its timestamp so re-running
-- the migration is safe (ON CONFLICT DO NOTHING).

INSERT INTO pickup_slots (id, slot_time, capacity, used_capacity)
SELECT
  gen_random_uuid(),
  slot_time,
  5,
  0
FROM (
  SELECT generate_series(
    date_trunc('day', now()) + INTERVAL '1 day' + INTERVAL '9 hours',
    date_trunc('day', now()) + INTERVAL '7 days' + INTERVAL '17 hours',
    INTERVAL '15 minutes'
  ) AS slot_time
) AS slots
WHERE
  -- Only slots within operating hours (09:00–17:00 inclusive start, exclusive end)
  EXTRACT(HOUR FROM slot_time AT TIME ZONE 'America/Los_Angeles') >= 9
  AND EXTRACT(HOUR FROM slot_time AT TIME ZONE 'America/Los_Angeles') < 17
  -- Exclude the 17:00 boundary (last valid slot starts at 16:45)
  AND NOT (
    EXTRACT(HOUR FROM slot_time AT TIME ZONE 'America/Los_Angeles') = 17
    AND EXTRACT(MINUTE FROM slot_time AT TIME ZONE 'America/Los_Angeles') = 0
  );
