import { z } from "zod";

export const createMenuItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  basePrice: z.number().int().nonnegative(),
  category: z.enum(["drinks", "food", "extras"]),
});

export const updateMenuItemSchema = createMenuItemSchema.partial();

export const createGroupSchema = z.object({
  label: z.string().min(1),
  required: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
});

export const updateGroupSchema = createGroupSchema.partial();

export const createOptionSchema = z.object({
  label: z.string().min(1),
  priceDelta: z.number().int(), // may be negative
  sortOrder: z.number().int().nonnegative(),
});

export const updateOptionSchema = createOptionSchema.partial();
