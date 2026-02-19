import { NextResponse } from 'next/server';

export async function GET() {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  const staticPages = [
    '/',
    '/quran',
    '/hadith',
    '/plan',
    '/today',
    '/reminders',
    '/settings',
  ];

  // Build XML sitemap
  const urls: string[] = [];

  for (const p of staticPages) {
    urls.push(`<url><loc>${baseUrl}${p}</loc></url>`);
  }

  // Add Quran surah pages (1..114)
  for (let i = 1; i <= 114; i++) {
    urls.push(`<url><loc>${baseUrl}/quran/${i}</loc></url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urls.join('\n')}
  </urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=0, s-maxage=3600',
    },
  });
}
