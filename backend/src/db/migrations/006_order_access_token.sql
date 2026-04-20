-- Order access control tokens.
-- Only the SHA-256 hash is stored long-term; plaintext is never persisted.
-- GET /orders/:id?token=<plaintext> hashes the token and compares against this column.
-- Requirements: 7.2

ALTER TABLE orders ADD COLUMN IF NOT EXISTS access_token_hash TEXT;

CREATE INDEX IF NOT EXISTS orders_access_token_hash_idx ON orders (access_token_hash);
