import path from "node:path";
import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false });

const DB_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("No DATABASE_URL or DIRECT_URL found in environment");
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    console.log("Altering hadith.hadith_no to be nullable...");
    await client.query("BEGIN");
    // Check if column exists
    const col = await client.query(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'hadith' AND column_name = 'hadith_no'
    `);
    if (col.rows.length === 0) {
      console.warn('Column hadith.hadith_no not found — skipping');
      await client.query('ROLLBACK');
      return;
    }
    const isNullable = col.rows[0].is_nullable === 'YES';
    if (isNullable) {
      console.log('Column already nullable.');
      await client.query('ROLLBACK');
      return;
    }

    await client.query("ALTER TABLE public.hadith ALTER COLUMN hadith_no DROP NOT NULL");
    await client.query("COMMIT");
    console.log('Success: hadith.hadith_no is now nullable.');
  } catch (e) {
    console.error('Failed to alter column:', e);
    try { await client.query('ROLLBACK'); } catch {}
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
