/**
 * Minimal migration runner.
 * Migrations are plain SQL files in src/db/migrations/, named NNN_description.sql.
 * Run: npm run migrate
 * Rollback: npm run migrate rollback
 */
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { Pool } from "pg";

const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "..", "..", ".env"),
  path.resolve(process.cwd(), "backend", ".env"),
  path.resolve(__dirname, "..", "..", "..", ".env"),
];

const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));
if (envPath) {
  dotenv.config({ path: envPath });
  console.log(`Loaded environment from ${envPath}`);
} else {
  console.warn("No .env file found; using existing environment variables.");
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Create a .env file or set DATABASE_URL in the environment."
  );
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function ensureMigrationsTable(client: import("pg").PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id        SERIAL PRIMARY KEY,
      filename  TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT now()
    )
  `);
}

async function getApplied(client: import("pg").PoolClient): Promise<string[]> {
  const { rows } = await client.query<{ filename: string }>(
    "SELECT filename FROM schema_migrations ORDER BY id"
  );
  return rows.map((r) => r.filename);
}

async function runMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }

  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getApplied(client);

    const files = fs
      .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
      .map((entry) => entry.name)
      .sort();

    if (files.length === 0) {
      console.log("No migration files found.");
      return;
    }

    for (const file of files) {
      if (applied.includes(file)) continue;
      console.log(`Applying migration: ${file}`);
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, "utf8");
      if (!sql.trim()) {
        console.log(`  skipping empty migration: ${file}`);
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [file]
        );
        await client.query("COMMIT");
        console.log(`  ✓ ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
    console.log("Migrations complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

