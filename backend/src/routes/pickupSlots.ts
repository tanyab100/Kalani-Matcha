import { Router, Request, Response, NextFunction } from "express";
import { pool } from "../db/pool";
import { isWithinStoreHours } from "../config/storeHours";

export const pickupSlotsRouter = Router();

// GET /pickup-slots — returns available pickup slots
// Filters: 10-min prep rule, operating hours, remaining capacity
// Requirements: 5.3, 5.4, 5.5
pickupSlotsRouter.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        id,
        slot_time,
        capacity,
        used_capacity
      FROM pickup_slots
      WHERE slot_time >= NOW() + INTERVAL '10 minutes'
        AND used_capacity < capacity
      ORDER BY slot_time ASC
    `);

    const slots = rows
      .filter((row) => isWithinStoreHours(new Date(row.slot_time)))
      .map((row) => ({
        id: row.id,
        time: new Date(row.slot_time).toISOString(),
        capacity: row.capacity,
        usedCapacity: row.used_capacity,
        available: row.used_capacity < row.capacity,
      }));

    res.json({ slots });
  } catch (err) {
    next(err);
  }
});
