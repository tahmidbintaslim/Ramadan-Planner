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
        const resCount = await client.query('SELECT count(*)::int AS cnt FROM hadith');
        console.log('hadith count:', resCount.rows[0].cnt);

        const resSample = await client.query(
            `SELECT id, edition_name, hadith_no, book, chapter, text, reference, created_at
             FROM hadith ORDER BY id DESC LIMIT 5`
        );
        console.log('sample rows:');
        for (const r of resSample.rows) {
            console.log({ id: r.id, edition_name: r.edition_name, hadith_no: r.hadith_no });
        }
    } catch (err) {
        console.error('DB query error:', err);
        process.exitCode = 1;
    } finally {
        await client.end();
    }
}

main();
