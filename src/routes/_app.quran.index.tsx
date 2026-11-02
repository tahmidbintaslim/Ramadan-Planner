import { createFileRoute } from "@tanstack/react-router";
import { QuranSurahList } from "@/components/quran/quran-surah-list";

// `index` so the Task 6 sibling `_app.quran.$surah.tsx` does not turn this into a layout that needs an Outlet.
export const Route = createFileRoute("/_app/quran/")({ component: QuranSurahList });
