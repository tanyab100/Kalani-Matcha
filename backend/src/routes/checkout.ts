import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { stripe } from "../config/stripe";
import { isWithinStoreHours } from "../config/storeHours";
import { TAX_RATE } from "../config/taxRate";
import { validateBody } from "../middleware/validate";
import { createError } from "../middleware/errorHandler";

export const checkoutRouter = Router();

const CartItemSchema = z.object({
  menuItemId: z.string().uuid(),
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  selectedCustomizations: z.record(z.string(), z.string()),
  customizationLabels: z.array(z.string()).optional(),
  // unitPrice from client is ignored — server recalculates from DB
});

const CartSchema = z.object({
  items: z.array(CartItemSchema).min(1),
  // subtotal/tax/total from client are ignored — server recalculates
  tip: z.number().int().nonnegative(), // tip is customer-chosen; validated >= 0
});

const IntentBodySchema = z.object({
  cart: CartSchema,
  pickupSlotId: z.string().uuid(),
  idempotencyKey: z.string().min(1),
  paymentMethod: z.enum(["card", "venmo"]).default("card"),
  // Optional customer context — populated when user is signed in (auth added in task 12)
  customerId: z.string().uuid().optional(),
  guestEmail: z.string().email().optional(),
});

// POST /checkout/intent
// Accept cart summary, selected slot, and idempotency key.
// Revalidate cart totals and slot availability, then create a Stripe PaymentIntent.
// Requirements: 6.2, 6.5
checkoutRouter.post(
  "/intent",
  validateBody(IntentBodySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cart, pickupSlotId, idempotencyKey, paymentMethod, customerId, guestEmail } =
        req.body as z.infer<typeof IntentBodySchema>;

      // --- Recalculate totals server-side from DB prices (never trust client totals) ---
      const menuItemIds = cart.items.map((i) => i.menuItemId);
      const { rows: menuRows } = await pool.query(
        `SELECT mi.id AS menu_item_id,
                mi.base_price,
                co.customization_group_id AS group_id,
                co.id AS option_id,
                co.price_delta
         FROM menu_items mi
         LEFT JOIN customization_groups cg ON cg.menu_item_id = mi.id
         LEFT JOIN customization_options co ON co.customization_group_id = cg.id
         WHERE mi.id = ANY($1) AND mi.in_stock = true`,
        [menuItemIds]
      );

      // Build a lookup: menuItemId -> { basePrice, options: Map<optionId, priceDelta> }
      const itemPriceMap = new Map<string, { basePrice: number; optionDeltas: Map<string, number> }>();
      for (const row of menuRows) {
        if (!itemPriceMap.has(row.menu_item_id)) {
          itemPriceMap.set(row.menu_item_id, { basePrice: row.base_price, optionDeltas: new Map() });
        }
        if (row.option_id) {
          itemPriceMap.get(row.menu_item_id)!.optionDeltas.set(row.option_id, row.price_delta);
        }
      }

      // Verify all items are available and compute server-side subtotal
      // Also build enriched items with server-calculated unitPrice for metadata
      let serverSubtotal = 0;
      const enrichedItems: Array<typeof cart.items[number] & { unitPrice: number }> = [];
      for (const item of cart.items) {
        const priceData = itemPriceMap.get(item.menuItemId);
        if (!priceData) {
          return next(createError(`Item ${item.menuItemId} is unavailable`, 422, "ITEM_UNAVAILABLE"));
        }
        let unitPrice = priceData.basePrice;
        for (const optionId of Object.values(item.selectedCustomizations)) {
          unitPrice += priceData.optionDeltas.get(optionId) ?? 0;
        }
        serverSubtotal += unitPrice * item.quantity;
        enrichedItems.push({ ...item, unitPrice });
      }

      const serverTax = Math.round(serverSubtotal * TAX_RATE);
      const serverTotal = serverSubtotal + serverTax + cart.tip; // tip is customer-chosen

      // --- Revalidate slot availability ---
      const { rows } = await pool.query(
        `SELECT id, slot_time, capacity, used_capacity
         FROM pickup_slots
         WHERE id = $1`,
        [pickupSlotId]
      );

      if (rows.length === 0) {
        return next(createError("Pickup slot not found", 409, "SLOT_UNAVAILABLE"));
      }

      const slot = rows[0];
      const slotTime = new Date(slot.slot_time);
      const now = new Date();
      const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);

      if (slotTime < tenMinutesFromNow) {
        return next(createError("Pickup slot is no longer available", 409, "SLOT_UNAVAILABLE"));
      }

      if (!isWithinStoreHours(slotTime)) {
        return next(createError("Pickup slot is outside store operating hours", 409, "SLOT_UNAVAILABLE"));
      }

      if (slot.used_capacity >= slot.capacity) {
        return next(createError("Pickup slot is fully booked", 409, "SLOT_CAPACITY_EXCEEDED"));
      }

      // --- Create Stripe PaymentIntent using server-calculated amount ---
      // Store full order context in metadata so the webhook can create the order
      // without needing a separate DB lookup or trusting client-supplied values.
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: serverTotal, // cents, calculated from DB — never from client
          currency: "usd",
          metadata: {
            idempotencyKey,
            pickupSlotId,
            paymentMethod,
            subtotal: String(serverSubtotal),
            tax: String(serverTax),
            tip: String(cart.tip),
            total: String(serverTotal),
            items: JSON.stringify(enrichedItems),
            // Optional customer context
            ...(customerId ? { customerId } : {}),
            ...(guestEmail ? { guestEmail } : {}),
          },
        },
        {
          idempotencyKey, // prevents duplicate charges on retry (Req 6.5)
        }
      );

      res.json({
        clientSecret: paymentIntent.client_secret,
        // Return server-calculated totals so the UI can display the authoritative amounts
        serverTotals: { subtotal: serverSubtotal, tax: serverTax, tip: cart.tip, total: serverTotal },
      });
    } catch (err) {
      next(err);
    }
  }
);

import { createOrder } from "../services/orderService";

const VenmoOrderBodySchema = z.object({
  cart: CartSchema,
  pickupSlotId: z.string().uuid(),
  idempotencyKey: z.string().min(1),
  customerId: z.string().uuid().optional(),
  guestEmail: z.string().email().optional(),
});

// POST /checkout/venmo-order
// Creates a Venmo order server-side with status = 'pending_payment'.
// Validates cart totals and slot availability (same as card flow).
// Requirements: 6.9
checkoutRouter.post(
  "/venmo-order",
  validateBody(VenmoOrderBodySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cart, pickupSlotId, idempotencyKey, customerId, guestEmail } =
        req.body as z.infer<typeof VenmoOrderBodySchema>;

      // --- Recalculate totals server-side from DB prices ---
      const menuItemIds = cart.items.map((i) => i.menuItemId);
      const { rows: menuRows } = await pool.query(
        `SELECT mi.id AS menu_item_id,
                mi.base_price,
                co.id AS option_id,
                co.price_delta
         FROM menu_items mi
         LEFT JOIN customization_groups cg ON cg.menu_item_id = mi.id
         LEFT JOIN customization_options co ON co.customization_group_id = cg.id
         WHERE mi.id = ANY($1) AND mi.in_stock = true`,
        [menuItemIds]
      );

      const itemPriceMap = new Map<string, { basePrice: number; optionDeltas: Map<string, number> }>();
      for (const row of menuRows) {
        if (!itemPriceMap.has(row.menu_item_id)) {
          itemPriceMap.set(row.menu_item_id, { basePrice: row.base_price, optionDeltas: new Map() });
        }
        if (row.option_id) {
          itemPriceMap.get(row.menu_item_id)!.optionDeltas.set(row.option_id, row.price_delta);
        }
      }

      let serverSubtotal = 0;
      const enrichedItems: Array<typeof cart.items[number] & { unitPrice: number }> = [];
      for (const item of cart.items) {
        const priceData = itemPriceMap.get(item.menuItemId);
        if (!priceData) {
          return next(createError(`Item ${item.menuItemId} is unavailable`, 422, "ITEM_UNAVAILABLE"));
        }
        let unitPrice = priceData.basePrice;
        for (const optionId of Object.values(item.selectedCustomizations)) {
          unitPrice += priceData.optionDeltas.get(optionId) ?? 0;
        }
        serverSubtotal += unitPrice * item.quantity;
        enrichedItems.push({ ...item, unitPrice });
      }

      const serverTax = Math.round(serverSubtotal * TAX_RATE);
      const serverTotal = serverSubtotal + serverTax + cart.tip;

      // --- Revalidate slot availability ---
      const { rows } = await pool.query(
        `SELECT id, slot_time, capacity, used_capacity FROM pickup_slots WHERE id = $1`,
        [pickupSlotId]
      );

      if (rows.length === 0) {
        return next(createError("Pickup slot not found", 409, "SLOT_UNAVAILABLE"));
      }

      const slot = rows[0];
      const slotTime = new Date(slot.slot_time);
      const now = new Date();
      const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);

      if (slotTime < tenMinutesFromNow) {
        return next(createError("Pickup slot is no longer available", 409, "SLOT_UNAVAILABLE"));
      }

      if (!isWithinStoreHours(slotTime)) {
        return next(createError("Pickup slot is outside store operating hours", 409, "SLOT_UNAVAILABLE"));
      }

      if (slot.used_capacity >= slot.capacity) {
        return next(createError("Pickup slot is fully booked", 409, "SLOT_CAPACITY_EXCEEDED"));
      }

      // --- Create order with pending_payment status ---
      const { order, accessToken } = await createOrder({
        customerId: customerId ?? null,
        guestEmail,
        items: enrichedItems,
        subtotal: serverSubtotal,
        tax: serverTax,
        tip: cart.tip,
        total: serverTotal,
        pickupSlotId,
        paymentMethod: "venmo",
        idempotencyKey,
      });

      res.status(201).json({ order, accessToken });
    } catch (err) {
      next(err);
    }
  }
);
