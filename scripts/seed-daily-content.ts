/**
 * Seed daily_content rows (Day 1..30) via pg.
 * Usage: npx tsx scripts/seed-daily-content.ts
 */

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

const CHECKLIST_TEMPLATE = [
  "morningDhikr",
  "eveningDhikr",
  "istighfar",
  "charity",
  "goodDeeds",
  "durud",
];

const DAY_TASKS_BN = [
  "আজ অন্তত একজনকে ইফতার করান।",
  "আজ ১০ মিনিট বেশি কুরআন তিলাওয়াত করুন।",
  "আজ ১০০ বার ইস্তিগফার পড়ুন।",
  "আজ কোনো প্রয়োজনে থাকা কাউকে সহায়তা করুন।",
  "আজ নামাজের পর ৫ মিনিট দোয়া করুন।",
  "আজ একটি পরিবারকে খাবার দিয়ে সাহায্য করুন।",
  "আজ মোবাইল ব্যবহারের সময় কমিয়ে ইবাদতে মন দিন।",
  "আজ পরিবারের সাথে দীনী আলোচনা করুন।",
  "আজ অন্তত ২০ মিনিট তিলাওয়াত করুন।",
  "আজ কারও সাথে সুন্দর আচরণকে অগ্রাধিকার দিন।",
];

const DAY_TASKS_EN = [
  "Sponsor iftar for at least one person today.",
  "Read Quran 10 extra minutes today.",
  "Recite Istighfar 100 times today.",
  "Help someone in need today.",
  "Make dua for 5 minutes after salah.",
  "Support a family with food today.",
  "Reduce screen time and increase ibadah today.",
  "Have a short Islamic reflection with family.",
  "Recite Quran for at least 20 minutes today.",
  "Prioritize excellent character in all interactions today.",
];

function dailyTask(day: number, locale: "bn" | "en"): string {
  const idx = (day - 1) % 10;
  return locale === "bn" ? DAY_TASKS_BN[idx] : DAY_TASKS_EN[idx];
}

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  try {
    for (let day = 1; day <= 30; day++) {
      const ayahRef = day % 2 === 0 ? "সূরা আল-বাকারা ২:১৮৩" : "সূরা আল-ফাতিহা ১:১";
      const hadithRef = day % 2 === 0 ? "সহিহ মুসলিম" : "বুখারী ও মুসলিম";

      await client.query(
        `INSERT INTO daily_content (
          day,
          ayah_ar, ayah_bn, ayah_en, ayah_ref,
          hadith_ar, hadith_bn, hadith_en, hadith_ref,
          dua_ar, dua_bn, dua_en, dua_context,
          day_task_bn, day_task_en,
          checklist_template,
          updated_at
        ) VALUES (
          $1,
          $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13,
          $14, $15,
          $16::jsonb,
          NOW()
        )
        ON CONFLICT (day) DO UPDATE SET
          ayah_ar = EXCLUDED.ayah_ar,
          ayah_bn = EXCLUDED.ayah_bn,
          ayah_en = EXCLUDED.ayah_en,
          ayah_ref = EXCLUDED.ayah_ref,
          hadith_ar = EXCLUDED.hadith_ar,
          hadith_bn = EXCLUDED.hadith_bn,
          hadith_en = EXCLUDED.hadith_en,
          hadith_ref = EXCLUDED.hadith_ref,
          dua_ar = EXCLUDED.dua_ar,
          dua_bn = EXCLUDED.dua_bn,
          dua_en = EXCLUDED.dua_en,
          dua_context = EXCLUDED.dua_context,
          day_task_bn = EXCLUDED.day_task_bn,
          day_task_en = EXCLUDED.day_task_en,
          checklist_template = EXCLUDED.checklist_template,
          updated_at = NOW()`,
        [
          day,
          "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيمِ",
          `দিন ${day}: আল্লাহর নামে শুরু করুন এবং নিয়ত ঠিক রাখুন।`,
          `Day ${day}: Begin in the name of Allah and renew your intention.`,
          ayahRef,
          null,
          `দিন ${day}: ঈমানের সাথে রোযা রাখলে ক্ষমা লাভ হয়।`,
          `Day ${day}: Fasting with faith and hope brings forgiveness.`,
          hadithRef,
          "اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي",
          "হে আল্লাহ! আপনি ক্ষমাশীল, ক্ষমা করতে ভালোবাসেন, তাই আমাকে ক্ষমা করুন।",
          "O Allah, You are Most Forgiving and love forgiveness, so forgive me.",
          "রমজানে মাগফিরাত ও আত্মশুদ্ধির জন্য দোয়া",
          dailyTask(day, "bn"),
          dailyTask(day, "en"),
          JSON.stringify(CHECKLIST_TEMPLATE),
        ],
      );
    }

    const count = await client.query("SELECT count(*)::int AS count FROM daily_content");
    console.log(`✅ daily_content seeded. Row count: ${count.rows[0].count}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("❌ Failed to seed daily_content:", err);
  process.exit(1);
});
