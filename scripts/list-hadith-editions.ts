import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Listing hadith editions and language counts...");

  const langs = await prisma.$queryRaw`
    SELECT COALESCE(language,'(unknown)') AS language, COUNT(*)::int AS cnt
    FROM hadith_editions
    GROUP BY COALESCE(language,'(unknown)')
    ORDER BY cnt DESC;
  `;

  console.table(langs as any);

  const editions = await prisma.$queryRaw`
    SELECT name, COALESCE(language,'(unknown)') AS language, COUNT(h.*)::int AS entries
    FROM hadith_editions he
    LEFT JOIN hadith h ON h.edition_name = he.name
    GROUP BY name, COALESCE(language,'(unknown)')
    ORDER BY entries DESC
    LIMIT 50;
  `;

  console.log('\nTop editions by entry count:');
  console.table(editions as any);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
