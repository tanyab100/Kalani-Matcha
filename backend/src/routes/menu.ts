import { Router, Request, Response, NextFunction } from "express";
import { pool } from "../db/pool";
import type { MenuItem, CustomizationGroup, CustomizationOption } from "../types/menu";

export const menuRouter = Router();

// GET /menu — returns all menu items with nested customization groups and options
menuRouter.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        mi.id            AS item_id,
        mi.name          AS item_name,
        mi.description   AS item_description,
        mi.base_price    AS item_base_price,
        mi.category      AS item_category,
        mi.in_stock      AS item_in_stock,
        cg.id            AS group_id,
        cg.label         AS group_label,
        cg.required      AS group_required,
        cg.sort_order    AS group_sort_order,
        co.id            AS option_id,
        co.label         AS option_label,
        co.price_delta   AS option_price_delta,
        co.sort_order    AS option_sort_order
      FROM menu_items mi
      LEFT JOIN customization_groups cg ON cg.menu_item_id = mi.id
      LEFT JOIN customization_options co ON co.customization_group_id = cg.id
      WHERE mi.hidden = false AND mi.archived = false
      ORDER BY
        mi.category,
        mi.name,
        cg.sort_order,
        co.sort_order
    `);

    const itemMap = new Map<string, MenuItem>();
    const groupMap = new Map<string, CustomizationGroup>();

    for (const row of rows) {
      // Build or retrieve the menu item
      if (!itemMap.has(row.item_id)) {
        itemMap.set(row.item_id, {
          id: row.item_id,
          name: row.item_name,
          description: row.item_description ?? "",
          basePrice: row.item_base_price,
          category: row.item_category,
          inStock: row.item_in_stock,
          customizations: [],
        });
      }

      const item = itemMap.get(row.item_id)!;

      if (!row.group_id) continue;

      // Build or retrieve the customization group
      const groupKey = `${row.item_id}:${row.group_id}`;
      if (!groupMap.has(groupKey)) {
        const group: CustomizationGroup = {
          id: row.group_id,
          label: row.group_label,
          required: row.group_required,
          options: [],
        };
        groupMap.set(groupKey, group);
        item.customizations.push(group);
      }

      const group = groupMap.get(groupKey)!;

      if (!row.option_id) continue;

      const option: CustomizationOption = {
        id: row.option_id,
        label: row.option_label,
        priceDelta: row.option_price_delta,
      };
      group.options.push(option);
    }

    const items = Array.from(itemMap.values());
    res.json({ items });
  } catch (err) {
    next(err);
  }
});
