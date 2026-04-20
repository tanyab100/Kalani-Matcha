import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { createError } from "../middleware/errorHandler";
import { requireAdmin } from "../middleware/auth";
import type { Request, Response, NextFunction } from "express";

export const adminRouter = Router();

// GET /admin/pickup-slots
// Returns all pickup slots with availability info.
// Requirements: 11.3
adminRouter.get(
  "/pickup-slots",
  requireAdmin,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, slot_time, capacity, used_capacity,
                (used_capacity < capacity) AS available
         FROM pickup_slots
         ORDER BY slot_time ASC`
      );
      res.json({ slots: rows });
    } catch (err) {
      next(err);
    }
  }
);

const updateCapacitySchema = z.object({
  capacity: z.number().int().positive(),
});

// PATCH /admin/pickup-slots/:id/capacity
// Updates capacity for a future slot. Rejects past slots with 400.
// Requirements: 11.3
adminRouter.patch(
  "/pickup-slots/:id/capacity",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const parsed = updateCapacitySchema.safeParse(req.body);
      if (!parsed.success) {
        return next(
          createError("Invalid capacity value", 400, "VALIDATION_ERROR")
        );
      }
      const { capacity } = parsed.data;

      const { rows } = await pool.query(
        `SELECT id, slot_time, capacity, used_capacity FROM pickup_slots WHERE id = $1`,
        [id]
      );

      if (rows.length === 0) {
        return next(createError("Slot not found", 404, "SLOT_NOT_FOUND"));
      }

      const slot = rows[0] as { id: string; slot_time: Date; capacity: number; used_capacity: number };

      if (new Date(slot.slot_time) <= new Date()) {
        return next(
          createError("Cannot update capacity for a past slot", 400, "PAST_SLOT_UPDATE")
        );
      }

      const { rows: updated } = await pool.query(
        `UPDATE pickup_slots
         SET capacity = $2
         WHERE id = $1
         RETURNING id, slot_time, capacity, used_capacity,
                   (used_capacity < capacity) AS available`,
        [id, capacity]
      );

      res.json({ slot: updated[0] });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /admin/menu/items/:id
// Permanently deletes a menu item. Cascades to customization_groups and
// customization_options via ON DELETE CASCADE constraints in the schema.
// Returns 404 if the item does not exist.
// Requirements: 7.3, 7.5, 10.1, 10.2, 10.3
adminRouter.delete(
  "/menu/items/:id",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const { rowCount } = await pool.query(
        `DELETE FROM menu_items WHERE id = $1`,
        [id]
      );

      if (rowCount === 0) {
        return next(
          createError("Menu item not found", 404, "NOT_FOUND")
        );
      }

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// GET /admin/orders
// Returns all orders newest first, with pickup slot time.
adminRouter.get(
  "/orders",
  requireAdmin,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const { rows } = await pool.query(
        `SELECT o.id, o.status, o.payment_method, o.payment_reference,
                o.subtotal, o.tax, o.tip, o.total,
                o.items_snapshot, o.guest_email, o.customer_id,
                o.created_at, o.payment_confirmed_at,
                ps.slot_time
         FROM orders o
         LEFT JOIN pickup_slots ps ON ps.id = o.pickup_slot_id
         ORDER BY o.created_at DESC`
      );
      res.json({ orders: rows });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /admin/orders/:id/status — advance order through preparing → ready
adminRouter.patch(
  "/orders/:id/status",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status } = req.body as { status?: string };
      const allowed = ["received", "preparing", "ready"];
      if (!status || !allowed.includes(status)) {
        return next(createError("Invalid status", 400, "VALIDATION_ERROR"));
      }
      const { rows } = await pool.query(
        `UPDATE orders SET status = $1 WHERE id = $2 RETURNING id, status`,
        [status, id]
      );
      if (rows.length === 0) return next(createError("Order not found", 404, "NOT_FOUND"));
      res.json({ order: rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// Advances order status from 'pending_payment' to 'received'.
// Records audit fields: confirmed_at timestamp and confirmed_by (admin customer id).
// Restricted to Store_Admin role via JWT.
// Requirements: 6.10, 11.3
adminRouter.post(
  "/orders/:id/confirm-payment",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const adminId = req.customer!.id;

      const { rows } = await pool.query(
        `SELECT id, status, payment_method, payment_reference FROM orders WHERE id = $1`,
        [id]
      );

      if (rows.length === 0) {
        return next(createError("Order not found", 404, "ORDER_NOT_FOUND"));
      }

      const order = rows[0] as { id: string; status: string; payment_method: string; payment_reference: string | null };

      if (order.status !== "pending_payment") {
        return next(
          createError(
            `Order is not in pending_payment status (current: ${order.status})`,
            400,
            "INVALID_STATUS_TRANSITION"
          )
        );
      }

      const { rows: updated } = await pool.query(
        `UPDATE orders
         SET status = 'received',
             payment_confirmed_at = now(),
             payment_confirmed_by = $2
         WHERE id = $1
         RETURNING id, status, payment_method, payment_reference, payment_confirmed_at, payment_confirmed_by`,
        [id, adminId]
      );

      res.json({ order: updated[0] });
    } catch (err) {
      next(err);
    }
  }
);
