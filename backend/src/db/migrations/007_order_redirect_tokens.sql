-- Short-lived, single-use redirect tokens for the card payment confirmation flow.
-- After Stripe confirms payment, the webhook creates one of these tokens.
-- The client exchanges it once (POST /orders/exchange-redirect-token) to get
-- the order ID and access token. The token is then marked used and expires.
-- TTL: 5 minutes. Single-use enforced by used_at timestamp.

CREATE TABLE IF NOT EXISTS order_redirect_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL UNIQUE,
  -- access_token_hash of the order, returned on exchange so client can build the URL
  -- without a second round-trip. We return the order's access_token_hash here
  -- only to allow the client to construct the polling URL; the actual token
  -- validation on GET /orders/:id still uses the orders.access_token_hash column.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '5 minutes',
  used_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS order_redirect_tokens_token_hash_idx ON order_redirect_tokens (token_hash);
CREATE INDEX IF NOT EXISTS order_redirect_tokens_order_id_idx   ON order_redirect_tokens (order_id);
