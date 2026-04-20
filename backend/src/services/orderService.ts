import { createHash, randomBytes } from "crypto";
import { pool } from "../db/pool";
import { createError } from "../middleware/errorHandler";
import type { Order, CreateOrderInput, CartItem } from "../types/order";

/** Generate a cryptographically random token and its SHA-256 hash. */
function generateToken(): { plaintext: string; hash: string } {
  const plaintext = randomBytes(32).toString("hex"); // 64-char hex string
  const hash = createHash("sha256").update(plaintext).digest("hex");
  return { plaintext, hash };
}

/** Hash a plaintext token for constant-time comparison against a stored hash. */
export function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

// Keep the old export name as an alias so existing callers don't break
export const hashAccessToken = hashToken;

// Map a raw DB row to the Order interface
export function rowToOrder(row: Record<string, unknown>): Order {
  return {
    id: row.id as string,
    customerId: (row.customer_id as string | null) ?? null,
    guestEmail: row.guest_email as string | undefined,
    items: row.items_snapshot as CartItem[],
    subtotal: row.subtotal as number,
    tax: row.tax as number,
    tip: row.tip as number,
    total: row.total as number,
    pickupSlotId: row.pickup_slot_id as string,
    pickupTime: row.slot_time as string,
    status: row.status as Order["status"],
    paymentMethod: row.payment_method as Order["paymentMethod"],
    paymentReference: row.payment_reference as string | undefined,
    paymentConfirmedAt: row.payment_confirmed_at
      ? (row.payment_confirmed_at as Date).toISOString()
      : undefined,
    paymentConfirmedBy: row.payment_confirmed_by as string | undefined,
    createdAt: (row.created_at as Date).toISOString(),
    idempotencyKey: row.idempotency_key as string,
    paymentIntentId: row.payment_intent_id as string | undefined,
  };
}

export interface CreateOrderResult {
  order: Order;
  /** Plaintext access token — returned once to the client, never stored in plaintext. */
  accessToken: string;
}

/**
 * Inserts a new order row and returns the created Order plus a one-time access token.
 * Card orders are created with status = 'received'.
 * Venmo orders are created with status = 'pending_payment'.
 *
 * Access token (Requirements: 7.2 access control):
 * A random 32-byte token is generated per order. Its SHA-256 hash is stored in
 * `access_token_hash`. The plaintext is returned once and must be presented by
 * the client on GET /orders/:id to prove ownership.
 *
 * Capacity enforcement (Requirements: 11.2, 11.4):
 * Within a transaction, the pickup slot row is locked with SELECT ... FOR UPDATE
 * to prevent race conditions. If adding the new order would exceed the slot's
 * capacity, the transaction is rolled back and a SLOT_CAPACITY_EXCEEDED error
 * is thrown. On success, used_capacity is incremented atomically.
 *
 * Idempotency guarantee (Requirements: 6.5):
 * If two simultaneous webhook deliveries both pass the pre-check in the route
 * handler, one will win the INSERT and the other will hit the UNIQUE constraint
 * on `idempotency_key` (PostgreSQL error code 23505). In that case we fetch and
 * return the already-created order instead of throwing, ensuring exactly one
 * order is ever created per idempotency key regardless of concurrent retries.
 *
 * Requirements: 5.9, 6.5, 6.6, 11.2, 11.4
 */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const status = input.paymentMethod === "venmo" ? "pending_payment" : "received";
  const newOrderQty = input.items.reduce((sum, item) => sum + item.quantity, 0);

  // Venmo orders: generate access token now and return it directly (no redirect token needed).
  // Card orders: access_token_hash starts NULL and is only populated by exchangeRedirectToken.
  //   This means no token can ever match until the exchange completes — there is no
  //   "initial card token" window where an unreachable hash could theoretically be used.
  const venmoToken = input.paymentMethod === "venmo" ? generateToken() : null;
  const accessTokenHash = venmoToken?.hash ?? null;
  const accessToken = venmoToken?.plaintext ?? "";

  const client = await pool.connect();
  let txDone = false;
  try {
    await client.query("BEGIN");

    const slotResult = await client.query(
      `SELECT id, capacity, used_capacity FROM pickup_slots WHERE id = $1 FOR UPDATE`,
      [input.pickupSlotId]
    );

    if (slotResult.rows.length === 0) {
      await client.query("ROLLBACK");
      txDone = true;
      throw createError("Pickup slot not found", 404, "SLOT_NOT_FOUND");
    }

    const slot = slotResult.rows[0] as { id: string; capacity: number; used_capacity: number };

    if (slot.used_capacity + newOrderQty > slot.capacity) {
      await client.query("ROLLBACK");
      txDone = true;
      throw createError(
        "This pickup slot is at capacity. Please select a different time.",
        409,
        "SLOT_CAPACITY_EXCEEDED"
      );
    }

    const insertResult = await client.query(
      `INSERT INTO orders
         (customer_id, guest_email, items_snapshot, subtotal, tax, tip, total,
          pickup_slot_id, status, payment_method, idempotency_key, payment_intent_id,
          payment_reference, access_token_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
         CASE WHEN $10 = 'venmo' THEN 'Order ' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8)) ELSE NULL END,
         $13
       )
       RETURNING
         orders.*,
         (SELECT slot_time FROM pickup_slots WHERE id = orders.pickup_slot_id) AS slot_time`,
      [
        input.customerId ?? null,
        input.guestEmail ?? null,
        JSON.stringify(input.items),
        input.subtotal,
        input.tax,
        input.tip,
        input.total,
        input.pickupSlotId,
        status,
        input.paymentMethod,
        input.idempotencyKey,
        input.paymentIntentId ?? null,
        accessTokenHash,  // Venmo: hash of plaintext returned to client. Card: NULL until exchangeRedirectToken runs.
      ]
    );

    await client.query(
      `UPDATE pickup_slots SET used_capacity = used_capacity + $1 WHERE id = $2`,
      [newOrderQty, input.pickupSlotId]
    );

    await client.query("COMMIT");
    txDone = true;

    return { order: rowToOrder(insertResult.rows[0]), accessToken };
  } catch (err: unknown) {
    if (!txDone) {
      try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    }

    if (
      typeof err === "object" &&
      err !== null &&
      (err as { code?: string }).code === "23505" &&
      (err as { constraint?: string }).constraint?.includes("idempotency_key")
    ) {
      const existing = await getOrderByIdempotencyKey(input.idempotencyKey);
      if (existing) return { order: existing, accessToken: "" };
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Creates a short-lived (5 min), single-use redirect token for a confirmed card order.
 * Called by the webhook after order creation. The plaintext token is embedded in
 * Stripe's payment_intent metadata so the client can retrieve it via the
 * POST /orders/exchange-redirect-token endpoint.
 *
 * Only the hash is stored — plaintext is never persisted.
 */
export async function createRedirectToken(orderId: string): Promise<string> {
  const { plaintext, hash } = generateToken();
  await pool.query(
    `INSERT INTO order_redirect_tokens (order_id, token_hash)
     VALUES ($1, $2)`,
    [orderId, hash]
  );
  return plaintext;
}

export interface ExchangeResult {
  orderId: string;
  accessToken: string;
}

/**
 * Exchanges a one-time redirect token for a fresh order access token.
 *
 * Transaction guarantees (all-or-nothing):
 *   1. Token exists            — UPDATE returns 0 rows if token_hash not found
 *   2. Token not expired       — expires_at > now() checked in the same UPDATE
 *   3. Token not used          — used_at IS NULL checked in the same UPDATE
 *   4. Token marked used       — SET used_at = now() in the same UPDATE statement
 *   5. New access token hash written — UPDATE orders SET access_token_hash in same tx
 *
 * Steps 1-4 are a single atomic UPDATE statement. If it matches 0 rows, we
 * ROLLBACK before step 5 ever runs — the orders row is never touched.
 * If step 5 fails, the entire transaction rolls back, un-marking the redirect
 * token so the client can retry.
 *
 * Old token invalidation: orders.access_token_hash is a single column. Writing
 * a new hash in step 5 atomically replaces the old one. After COMMIT, any
 * previously issued access token (including the initial NULL for card orders)
 * will not match and GET /orders/:id will return 403.
 *
 * Concurrency: SELECT ... FOR UPDATE on the orders row prevents two concurrent
 * exchanges from both reading the old hash and both writing — the second will
 * block until the first commits, then proceed with the already-used redirect
 * token and get 0 rows from the UPDATE, returning 403.
 */
export async function exchangeRedirectToken(plaintext: string): Promise<ExchangeResult> {
  const hash = hashToken(plaintext);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Step 1-4: atomically validate and consume the redirect token
    const { rows: tokenRows } = await client.query(
      `UPDATE order_redirect_tokens
       SET used_at = now()
       WHERE token_hash = $1
         AND used_at IS NULL
         AND expires_at > now()
       RETURNING order_id`,
      [hash]
    );

    if (tokenRows.length === 0) {
      await client.query("ROLLBACK");
      throw createError("Invalid or expired redirect token", 403, "FORBIDDEN");
    }

    const orderId = (tokenRows[0] as { order_id: string }).order_id;

    // Lock the order row to prevent concurrent exchanges racing on the same order
    await client.query(
      `SELECT id FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    );

    // Step 5: issue a fresh access token and overwrite the hash — old token is gone
    const { plaintext: newAccessToken, hash: newAccessTokenHash } = generateToken();
    await client.query(
      `UPDATE orders SET access_token_hash = $1 WHERE id = $2`,
      [newAccessTokenHash, orderId]
    );

    await client.query("COMMIT");
    return { orderId, accessToken: newAccessToken };
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Fetches an order by its ID. Returns null if not found.
 */
export async function getOrderById(id: string): Promise<Order | null> {
  const { rows } = await pool.query(
    `SELECT o.*,
            ps.slot_time
     FROM orders o
     LEFT JOIN pickup_slots ps ON ps.id = o.pickup_slot_id
     WHERE o.id = $1`,
    [id]
  );

  if (rows.length === 0) return null;
  return rowToOrder(rows[0]);
}

/**
 * Looks up an existing order by idempotency key.
 * Returns null if no matching order exists.
 * Used for idempotency checks on duplicate payment submissions.
 * Requirements: 6.5
 */
export async function getOrderByIdempotencyKey(
  idempotencyKey: string
): Promise<Order | null> {
  const { rows } = await pool.query(
    `SELECT o.*,
            ps.slot_time
     FROM orders o
     LEFT JOIN pickup_slots ps ON ps.id = o.pickup_slot_id
     WHERE o.idempotency_key = $1`,
    [idempotencyKey]
  );

  if (rows.length === 0) return null;
  return rowToOrder(rows[0]);
}
