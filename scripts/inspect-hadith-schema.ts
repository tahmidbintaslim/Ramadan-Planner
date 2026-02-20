import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
    console.error('No DIRECT_URL or DATABASE_URL found in .env.local');
    process.exit(2);
}

async function main() {
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
        const cols = await client.query(
            `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema='public' AND table_name='hadith' ORDER BY ordinal_position`
        );
        console.log('hadith columns:');
        for (const c of cols.rows) console.log(c);

        const sample = await client.query('SELECT * FROM hadith LIMIT 3');
        console.log('sample rows keys:', Object.keys(sample.rows[0] || {}));
    } catch (err) {
        console.error('Error inspecting schema:', err);
    } finally {
        await client.end();
    }
}

main();
