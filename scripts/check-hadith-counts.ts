import path from 'node:path';
import dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: false });

const DB_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!DB_URL) {
  console.error('No DATABASE_URL or DIRECT_URL found');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    const editions = await client.query('SELECT COUNT(*)::int AS c FROM hadith_editions');
    const hadith = await client.query('SELECT COUNT(*)::int AS c FROM hadith');
    const daily = await client.query('SELECT COUNT(*)::int AS c FROM daily_content');
    console.log('hadith_editions:', editions.rows[0].c);
    console.log('hadith:', hadith.rows[0].c);
    console.log('daily_content:', daily.rows[0].c);
  } catch (e) {
    console.error('Query failed:', e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
