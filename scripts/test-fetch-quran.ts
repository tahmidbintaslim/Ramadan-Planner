import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: false });
console.log('TEST ENV DATABASE_URL set?', !!process.env.DATABASE_URL);

;(async () => {
  console.log('TEST ENV DATABASE_URL set?', !!process.env.DATABASE_URL);
  try {
    const { fetchSurah } = await import('../src/lib/quran');
    const s = await fetchSurah(1);
    console.log('fetchSurah result:', !!s, s ? { surahNo: s.surahNo, ayahs: s.ayahs.length } : null);
  } catch (e) {
    console.error('fetchSurah error:', e);
  }
})();
