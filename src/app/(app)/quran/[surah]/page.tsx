import { QuranReader } from "@/components/quran/quran-reader";
import { notFound } from "next/navigation";
import { fetchSurah } from "@/lib/quran";

interface SurahPageProps {
  params: Promise<{ surah: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: { surah: string };
}) {
  const surahParam = params.surah;
  const surahNumber = parseInt(surahParam, 10);

  if (isNaN(surahNumber) || surahNumber < 1 || surahNumber > 114) {
    return {
      title: `Surah ${surahParam}`,
      description: `Surah ${surahParam}`,
    };
  }

  const surah = await fetchSurah(surahNumber);

  if (!surah) {
    return {
      title: `Surah ${surahNumber}`,
      description: `Surah ${surahNumber}`,
    };
  }

  const title = `${surah.nameEnglish} — সূরা ${surah.surahNo}`;
  const description = `${surah.nameBengali} (${surah.nameEnglish}) — ${surah.totalAyah} আয়াত`;

  const siteBase = process.env.NEXT_PUBLIC_SITE_URL || "";
  const pageUrl = siteBase
    ? `${siteBase.replace(/\/$/, "")}/quran/${surahNumber}`
    : `/quran/${surahNumber}`;

  return {
    title,
    description,
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title,
      description,
      url: pageUrl,
    },
  };
}

export default async function SurahPage({ params }: SurahPageProps) {
  const { surah } = await params;
  const surahNumber = parseInt(surah, 10);

  if (isNaN(surahNumber) || surahNumber < 1 || surahNumber > 114) {
    notFound();
  }

  return <QuranReader surahNumber={surahNumber} />;
}
