import { Router, type Request, type Response } from "express";
import { stripe } from "../config/stripe";
import { createOrder, createRedirectToken, getOrderByIdempotencyKey } from "../services/orderService";
import type { CartItem } from "../types/order";
import { ErrorCode } from "../types/errors";

export const webhookRouter = Router();

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

/**
 * POST /webhook/payment
 * Stripe webhook endpoint — creates an order on payment_intent.succeeded.
 * Requires raw body (registered before express.json() in app.ts).
 * Requirements: 5.9, 6.6
 */
webhookRouter.post("/payment", async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers["stripe-signature"];

  if (!sig) {
    res.status(400).json({ error: "MISSING_SIGNATURE", message: "Missing stripe-signature header" });
    return;
  }

  let event: ReturnType<typeof stripe.webhooks.constructEvent>;

  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signature verification failed";
    res.status(400).json({ error: "INVALID_SIGNATURE", message });
    return;
  }

  if (event.type !== "payment_intent.succeeded") {
    // Acknowledge unhandled event types without error
    res.status(200).json({ received: true });
    return;
  }

  const paymentIntent = event.data.object;
  const metadata = paymentIntent.metadata as Record<string, string>;

  const {
    idempotencyKey,
    customerId,
    guestEmail,
    pickupSlotId,
    subtotal,
    tax,
    tip,
    total,
    items: itemsJson,
    paymentMethod,
  } = metadata;

  // Guard: all required metadata fields must be present
  if (!idempotencyKey || !pickupSlotId || !subtotal || !tax || !total || !itemsJson) {
    res.status(400).json({ error: "INVALID_METADATA", message: "Payment intent is missing required order metadata" });
    return;
  }

  // Idempotency: return existing order if already created
  const existing = await getOrderByIdempotencyKey(idempotencyKey);
  if (existing) {
    res.status(200).json({ received: true, orderId: existing.id });
    return;
  }

  let items: CartItem[];
  try {
    items = JSON.parse(itemsJson) as CartItem[];
  } catch {
    res.status(400).json({ error: "INVALID_METADATA", message: "Failed to parse items from payment intent metadata" });
    return;
  }

  const { order } = await createOrder({
    customerId: customerId || null,
    guestEmail: guestEmail || undefined,
    items,
    subtotal: parseInt(subtotal, 10),
    tax: parseInt(tax, 10),
    tip: parseInt(tip, 10),
    total: parseInt(total, 10),
    pickupSlotId,
    paymentMethod: (paymentMethod as "card" | "venmo") ?? "card",
    idempotencyKey,
    paymentIntentId: paymentIntent.id,
  });

  // Create a short-lived redirect token the client can exchange once for the
  // order access token. This avoids storing the plaintext access token in the DB.
  const redirectToken = await createRedirectToken(order.id);

  res.status(200).json({ received: true, orderId: order.id, redirectToken });
});
