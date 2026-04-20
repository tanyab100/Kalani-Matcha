/**
 * One-time script to create a store_admin account.
 * Run: npm run create-admin
 */
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

const envPath = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "..", "..", ".env"),
].find((p) => fs.existsSync(p));

if (envPath) dotenv.config({ path: envPath });

const EMAIL = "admin@nami.com";
const PASSWORD = "nami-admin-2026";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const hash = await bcrypt.hash(PASSWORD, 10);
    const { rows } = await pool.query(
      `INSERT INTO customers (email, password_hash, role)
       VALUES ($1, $2, 'store_admin')
       ON CONFLICT (email) DO UPDATE SET role = 'store_admin', password_hash = $2
       RETURNING id, email, role`,
      [EMAIL, hash]
    );
    console.log("✓ Admin account ready:", rows[0]);
    console.log(`  Email:    ${EMAIL}`);
    console.log(`  Password: ${PASSWORD}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
