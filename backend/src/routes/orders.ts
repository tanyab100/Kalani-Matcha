import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { pool } from "../db/pool";
import { exchangeRedirectToken, hashAccessToken, rowToOrder } from "../services/orderService";
import { createError } from "../middleware/errorHandler";
import { rateLimit } from "../middleware/rateLimit";
import { requireAuth } from "../middleware/auth";
import { buildReorderCart } from "../services/reorderService";
import type { MenuItem } from "../types/menu";

export const ordersRouter = Router();

// Referrer-Policy: no-referrer on all order routes so the ?token= query string
// is never sent as a Referer header to third-party resources.
ordersRouter.use((_req, res, next) => {
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

// GET /orders/history — returns authenticated customer's orders, newest first
// Requirements: 8.1
ordersRouter.get("/history", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.*, ps.slot_time
       FROM orders o
       LEFT JOIN pickup_slots ps ON ps.id = o.pickup_slot_id
       WHERE o.customer_id = $1
       ORDER BY o.created_at DESC`,
      [req.customer!.id]
    );
    res.json({ orders: rows.map((row) => rowToOrder(row as Record<string, unknown>)) });
  } catch (err) {
    next(err);
  }
});

// POST /orders/exchange-redirect-token
// Single-use, 5-minute TTL token exchange for the card payment confirmation flow.
// The webhook creates a redirect token after order creation; the client POSTs it
// here once to receive the order ID and access token for the status URL.
// Rate-limited to 10 requests per minute per IP to prevent brute-force.
// Requirements: 7.2
ordersRouter.post(
  "/exchange-redirect-token",
  rateLimit(10, 60_000),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { redirectToken } = req.body as { redirectToken?: string };
      if (!redirectToken || typeof redirectToken !== "string") {
        return next(createError("redirectToken is required", 400, "VALIDATION_ERROR"));
      }

      const { orderId, accessToken } = await exchangeRedirectToken(redirectToken);
      res.json({ orderId, accessToken });
    } catch (err) {
      next(err);
    }
  }
);

// GET /orders/:id?token=<plaintext>
// Access control: requires ?token=<plaintext> matching the order's access_token_hash.
// Rate-limited to 60 requests per minute per IP (covers normal polling + some retries).
// When task 12 lands, a valid JWT for the order's customer_id will also be accepted.
// Requirements: 7.2
ordersRouter.get(
  "/:id",
  rateLimit(60, 60_000),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = typeof req.query.token === "string" ? req.query.token : null;

      if (!token) {
        return next(createError("Forbidden", 403, "FORBIDDEN"));
      }

      const tokenHash = hashAccessToken(token);
      const { rows } = await pool.query(
        `SELECT o.*, ps.slot_time
         FROM orders o
         LEFT JOIN pickup_slots ps ON ps.id = o.pickup_slot_id
         WHERE o.id = $1 AND o.access_token_hash = $2`,
        [req.params.id, tokenHash]
      );

      if (rows.length === 0) {
        // Same 403 whether the ID doesn't exist or the token is wrong —
        // avoids confirming whether an order ID exists.
        return next(createError("Forbidden", 403, "FORBIDDEN"));
      }

      const order = rowToOrder(rows[0] as Record<string, unknown>);

      // Enrich items_snapshot with human-readable customization labels
      // by resolving option IDs against the current customization_options table.
      const allOptionIds = order.items.flatMap((item) =>
        Object.values(item.selectedCustomizations)
      );

      if (allOptionIds.length > 0) {
        const { rows: optionRows } = await pool.query<{ id: string; label: string }>(
          `SELECT id, label FROM customization_options WHERE id = ANY($1)`,
          [allOptionIds]
        );
        const optionLabelMap = new Map(optionRows.map((r) => [r.id, r.label]));

        order.items = order.items.map((item) => ({
          ...item,
          customizationLabels: Object.values(item.selectedCustomizations)
            .map((optId) => optionLabelMap.get(optId))
            .filter((label): label is string => !!label),
        }));
      }

      res.json({ order });
    } catch (err) {
      next(err);
    }
  }
);

// POST /orders/:id/reorder — rebuild cart from a past order using current menu data
// Requirements: 8.3, 8.4, 8.5, 8.6
ordersRouter.post("/:id/reorder", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Fetch the original order, scoped to the authenticated customer
    const { rows: orderRows } = await pool.query(
      `SELECT * FROM orders WHERE id = $1 AND customer_id = $2`,
      [req.params.id, req.customer!.id]
    );

    if (orderRows.length === 0) {
      return next(createError("Order not found", 404, "NOT_FOUND"));
    }

    const pastItems = orderRows[0].items_snapshot as Array<{
      menuItemId: string;
      name: string;
      quantity: number;
      selectedCustomizations: Record<string, string>;
      unitPrice: number;
    }>;

    // Fetch current menu items with their customization groups and options
    const { rows: menuRows } = await pool.query<{
      id: string;
      name: string;
      description: string;
      base_price: number;
      category: string;
      in_stock: boolean;
      customizations: Array<{
        id: string;
        label: string;
        required: boolean;
        options: Array<{ id: string; label: string; priceDelta: number }> | null;
      }> | null;
    }>(
      `SELECT mi.*,
        json_agg(
          json_build_object(
            'id', cg.id,
            'label', cg.label,
            'required', cg.required,
            'options', (
              SELECT json_agg(json_build_object('id', co.id, 'label', co.label, 'priceDelta', co.price_delta))
              FROM customization_options co WHERE co.customization_group_id = cg.id
            )
          )
        ) FILTER (WHERE cg.id IS NOT NULL) AS customizations
       FROM menu_items mi
       LEFT JOIN customization_groups cg ON cg.menu_item_id = mi.id
       GROUP BY mi.id`
    );

    const currentMenuItems: MenuItem[] = menuRows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      basePrice: row.base_price,
      category: row.category as MenuItem["category"],
      inStock: row.in_stock,
      customizations: (row.customizations ?? []).map((cg) => ({
        id: cg.id,
        label: cg.label,
        required: cg.required,
        options: (cg.options ?? []).map((opt) => ({
          id: opt.id,
          label: opt.label,
          priceDelta: opt.priceDelta,
        })),
      })),
    }));

    const result = buildReorderCart(pastItems, currentMenuItems);
    res.json({
      items: result.cartItems,
      unavailableItems: result.unavailableItems.map((i) => i.name),
      staleCustomizationItems: result.staleCustomizationItems.map((i) => i.name),
    });
  } catch (err) {
    next(err);
  }
});
