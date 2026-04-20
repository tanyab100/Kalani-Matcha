import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { createError } from "../middleware/errorHandler";
import { requireAdmin } from "../middleware/auth";
import { createMenuItemSchema, updateMenuItemSchema, createGroupSchema, updateGroupSchema, createOptionSchema, updateOptionSchema } from "./adminMenuValidation";
import type { AdminMenuItem, AdminCustomizationGroup, AdminCustomizationOption } from "../types/menu";

export const adminMenuRouter = Router();

/** Map a DB row to the AdminMenuItem shape. */
function rowToAdminMenuItem(row: Record<string, unknown>): AdminMenuItem {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? "",
    basePrice: row.base_price as number,
    category: row.category as AdminMenuItem["category"],
    inStock: row.in_stock as boolean,
    hidden: row.hidden as boolean,
    archived: row.archived as boolean,
    customizations: [],
  };
}

// GET /admin/menu/items
// Returns all items (including hidden and archived), ordered by category then name.
// Requirements: 1.1, 1.2, 1.3, 1.4, 10.1, 10.2, 10.3
adminMenuRouter.get(
  "/menu/items",
  requireAdmin,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, name, description, base_price, category, in_stock, hidden, archived
         FROM menu_items
         ORDER BY category ASC, name ASC`
      );
      const items: AdminMenuItem[] = rows.map(rowToAdminMenuItem);
      res.json({ items });
    } catch (err) {
      next(err);
    }
  }
);

// POST /admin/menu/items
// Creates a new menu item with in_stock=true, hidden=false, archived=false defaults.
// Requirements: 2.1, 2.2, 2.3, 2.7, 10.1, 10.2, 10.3
adminMenuRouter.post(
  "/menu/items",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createMenuItemSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(createError("Validation error", 400, "VALIDATION_ERROR"));
      }
      const { name, description, basePrice, category } = parsed.data;

      const { rows } = await pool.query(
        `INSERT INTO menu_items (name, description, base_price, category, in_stock, hidden, archived)
         VALUES ($1, $2, $3, $4, true, false, false)
         RETURNING id, name, description, base_price, category, in_stock, hidden, archived`,
        [name, description, basePrice, category]
      );

      res.status(201).json({ item: rowToAdminMenuItem(rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /admin/menu/items/:id
// Updates item fields (name, description, basePrice, category).
// Returns 404 if item does not exist.
// Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 10.1, 10.2, 10.3
adminMenuRouter.patch(
  "/menu/items/:id",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const parsed = updateMenuItemSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(createError("Validation error", 400, "VALIDATION_ERROR"));
      }

      const data = parsed.data;
      if (Object.keys(data).length === 0) {
        return next(createError("No fields to update", 400, "VALIDATION_ERROR"));
      }

      // Build dynamic SET clause
      const setClauses: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (data.name !== undefined) {
        setClauses.push(`name = $${idx++}`);
        values.push(data.name);
      }
      if (data.description !== undefined) {
        setClauses.push(`description = $${idx++}`);
        values.push(data.description);
      }
      if (data.basePrice !== undefined) {
        setClauses.push(`base_price = $${idx++}`);
        values.push(data.basePrice);
      }
      if (data.category !== undefined) {
        setClauses.push(`category = $${idx++}`);
        values.push(data.category);
      }

      values.push(id);
      const { rows } = await pool.query(
        `UPDATE menu_items
         SET ${setClauses.join(", ")}
         WHERE id = $${idx}
         RETURNING id, name, description, base_price, category, in_stock, hidden, archived`,
        values
      );

      if (rows.length === 0) {
        return next(createError("Menu item not found", 404, "NOT_FOUND"));
      }

      res.json({ item: rowToAdminMenuItem(rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

const booleanValueSchema = z.object({ value: z.boolean() });

// PATCH /admin/menu/items/:id/in-stock
// Updates the in_stock flag. Returns 404 if item does not exist.
// Requirements: 4.2, 4.3, 4.4, 10.1, 10.2, 10.3
adminMenuRouter.patch(
  "/menu/items/:id/in-stock",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const parsed = booleanValueSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(createError("Validation error: 'value' must be a boolean", 400, "VALIDATION_ERROR"));
      }

      const { rows } = await pool.query(
        `UPDATE menu_items SET in_stock = $1 WHERE id = $2
         RETURNING id, name, description, base_price, category, in_stock, hidden, archived`,
        [parsed.data.value, id]
      );

      if (rows.length === 0) {
        return next(createError("Menu item not found", 404, "NOT_FOUND"));
      }

      res.json({ item: rowToAdminMenuItem(rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /admin/menu/items/:id/hidden
// Updates the hidden flag. Returns 404 if item does not exist.
// Requirements: 5.2, 5.3, 10.1, 10.2, 10.3
adminMenuRouter.patch(
  "/menu/items/:id/hidden",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const parsed = booleanValueSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(createError("Validation error: 'value' must be a boolean", 400, "VALIDATION_ERROR"));
      }

      const { rows } = await pool.query(
        `UPDATE menu_items SET hidden = $1 WHERE id = $2
         RETURNING id, name, description, base_price, category, in_stock, hidden, archived`,
        [parsed.data.value, id]
      );

      if (rows.length === 0) {
        return next(createError("Menu item not found", 404, "NOT_FOUND"));
      }

      res.json({ item: rowToAdminMenuItem(rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /admin/menu/items/:id/archived
// Updates the archived flag. Returns 404 if item does not exist.
// Requirements: 6.2, 6.5, 10.1, 10.2, 10.3
adminMenuRouter.patch(
  "/menu/items/:id/archived",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const parsed = booleanValueSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(createError("Validation error: 'value' must be a boolean", 400, "VALIDATION_ERROR"));
      }

      const { rows } = await pool.query(
        `UPDATE menu_items SET archived = $1 WHERE id = $2
         RETURNING id, name, description, base_price, category, in_stock, hidden, archived`,
        [parsed.data.value, id]
      );

      if (rows.length === 0) {
        return next(createError("Menu item not found", 404, "NOT_FOUND"));
      }

      res.json({ item: rowToAdminMenuItem(rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

/** Map a DB row to AdminCustomizationOption shape. */
function rowToAdminOption(row: Record<string, unknown>): AdminCustomizationOption {
  return {
    id: row.id as string,
    customizationGroupId: row.customization_group_id as string,
    label: row.label as string,
    priceDelta: row.price_delta as number,
    sortOrder: row.sort_order as number,
  };
}

/** Map a DB row to AdminCustomizationGroup shape (options populated separately). */
function rowToAdminGroup(row: Record<string, unknown>, options: AdminCustomizationOption[]): AdminCustomizationGroup {
  return {
    id: row.id as string,
    menuItemId: row.menu_item_id as string,
    label: row.label as string,
    required: row.required as boolean,
    sortOrder: row.sort_order as number,
    options,
  };
}

// GET /admin/menu/items/:id/groups
// Returns groups ordered by sort_order ASC with nested options ordered by sort_order ASC.
// Requirements: 8.1, 9.1, 10.1
adminMenuRouter.get(
  "/menu/items/:id/groups",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const { rows: groupRows } = await pool.query(
        `SELECT id, menu_item_id, label, required, sort_order
         FROM customization_groups
         WHERE menu_item_id = $1
         ORDER BY sort_order ASC`,
        [id]
      );

      const { rows: optionRows } = await pool.query(
        `SELECT co.id, co.customization_group_id, co.label, co.price_delta, co.sort_order
         FROM customization_options co
         INNER JOIN customization_groups cg ON cg.id = co.customization_group_id
         WHERE cg.menu_item_id = $1
         ORDER BY co.sort_order ASC`,
        [id]
      );

      const optionsByGroup = new Map<string, AdminCustomizationOption[]>();
      for (const opt of optionRows) {
        const groupId = opt.customization_group_id as string;
        if (!optionsByGroup.has(groupId)) optionsByGroup.set(groupId, []);
        optionsByGroup.get(groupId)!.push(rowToAdminOption(opt));
      }

      const groups: AdminCustomizationGroup[] = groupRows.map((row) =>
        rowToAdminGroup(row, optionsByGroup.get(row.id as string) ?? [])
      );

      res.json({ groups });
    } catch (err) {
      next(err);
    }
  }
);

// POST /admin/menu/items/:id/groups
// Creates a new customization group linked to the menu item.
// Requirements: 8.2, 8.3, 8.8, 10.1, 10.2, 10.3
adminMenuRouter.post(
  "/menu/items/:id/groups",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const parsed = createGroupSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(createError("Validation error", 400, "VALIDATION_ERROR"));
      }
      const { label, required, sortOrder } = parsed.data;

      const { rows } = await pool.query(
        `INSERT INTO customization_groups (menu_item_id, label, required, sort_order)
         VALUES ($1, $2, $3, $4)
         RETURNING id, menu_item_id, label, required, sort_order`,
        [id, label, required, sortOrder]
      );

      res.status(201).json({ group: rowToAdminGroup(rows[0], []) });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /admin/menu/groups/:id
// Updates a customization group. Returns 404 if not found.
// Requirements: 8.4, 8.5, 8.8, 10.1, 10.2, 10.3
adminMenuRouter.patch(
  "/menu/groups/:id",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const parsed = updateGroupSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(createError("Validation error", 400, "VALIDATION_ERROR"));
      }

      const data = parsed.data;
      if (Object.keys(data).length === 0) {
        return next(createError("No fields to update", 400, "VALIDATION_ERROR"));
      }

      const setClauses: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (data.label !== undefined) { setClauses.push(`label = $${idx++}`); values.push(data.label); }
      if (data.required !== undefined) { setClauses.push(`required = $${idx++}`); values.push(data.required); }
      if (data.sortOrder !== undefined) { setClauses.push(`sort_order = $${idx++}`); values.push(data.sortOrder); }

      values.push(id);
      const { rows } = await pool.query(
        `UPDATE customization_groups
         SET ${setClauses.join(", ")}
         WHERE id = $${idx}
         RETURNING id, menu_item_id, label, required, sort_order`,
        values
      );

      if (rows.length === 0) {
        return next(createError("Customization group not found", 404, "NOT_FOUND"));
      }

      // Fetch current options for the group
      const { rows: optionRows } = await pool.query(
        `SELECT id, customization_group_id, label, price_delta, sort_order
         FROM customization_options
         WHERE customization_group_id = $1
         ORDER BY sort_order ASC`,
        [id]
      );

      res.json({ group: rowToAdminGroup(rows[0], optionRows.map(rowToAdminOption)) });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /admin/menu/groups/:id
// Deletes a customization group (cascades to options). Returns 404 if not found.
// Requirements: 8.6, 8.7, 8.8, 10.1, 10.2, 10.3
adminMenuRouter.delete(
  "/menu/groups/:id",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const { rows } = await pool.query(
        `DELETE FROM customization_groups WHERE id = $1 RETURNING id`,
        [id]
      );

      if (rows.length === 0) {
        return next(createError("Customization group not found", 404, "NOT_FOUND"));
      }

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// POST /admin/menu/groups/:id/options
// Creates a new customization option linked to the group.
// Requirements: 9.2, 9.3, 9.9, 10.1, 10.2, 10.3
adminMenuRouter.post(
  "/menu/groups/:id/options",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const parsed = createOptionSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(createError("Validation error", 400, "VALIDATION_ERROR"));
      }
      const { label, priceDelta, sortOrder } = parsed.data;

      const { rows } = await pool.query(
        `INSERT INTO customization_options (customization_group_id, label, price_delta, sort_order)
         VALUES ($1, $2, $3, $4)
         RETURNING id, customization_group_id, label, price_delta, sort_order`,
        [id, label, priceDelta, sortOrder]
      );

      res.status(201).json({ option: rowToAdminOption(rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /admin/menu/options/:id
// Updates a customization option. Returns 404 if not found.
// Requirements: 9.4, 9.5, 9.6, 9.9, 10.1, 10.2, 10.3
adminMenuRouter.patch(
  "/menu/options/:id",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const parsed = updateOptionSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(createError("Validation error", 400, "VALIDATION_ERROR"));
      }

      const data = parsed.data;
      if (Object.keys(data).length === 0) {
        return next(createError("No fields to update", 400, "VALIDATION_ERROR"));
      }

      const setClauses: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      if (data.label !== undefined) { setClauses.push(`label = $${idx++}`); values.push(data.label); }
      if (data.priceDelta !== undefined) { setClauses.push(`price_delta = $${idx++}`); values.push(data.priceDelta); }
      if (data.sortOrder !== undefined) { setClauses.push(`sort_order = $${idx++}`); values.push(data.sortOrder); }

      values.push(id);
      const { rows } = await pool.query(
        `UPDATE customization_options
         SET ${setClauses.join(", ")}
         WHERE id = $${idx}
         RETURNING id, customization_group_id, label, price_delta, sort_order`,
        values
      );

      if (rows.length === 0) {
        return next(createError("Customization option not found", 404, "NOT_FOUND"));
      }

      res.json({ option: rowToAdminOption(rows[0]) });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /admin/menu/options/:id
// Deletes a single customization option. Returns 404 if not found.
// Requirements: 9.7, 9.8, 10.1, 10.2, 10.3
adminMenuRouter.delete(
  "/menu/options/:id",
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const { rows } = await pool.query(
        `DELETE FROM customization_options WHERE id = $1 RETURNING id`,
        [id]
      );

      if (rows.length === 0) {
        return next(createError("Customization option not found", 404, "NOT_FOUND"));
      }

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);
