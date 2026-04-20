import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString && process.env.NODE_ENV !== "test") {
  console.warn("DATABASE_URL not set — database features will not work");
}

export const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  console.error("Unexpected pg pool error", err);
});
