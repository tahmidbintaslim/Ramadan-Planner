// Server-only handler for GET /api/daily-content, ported from src/app/api/daily-content/route.ts.
import "@tanstack/react-start/server-only";
import { guarded, json } from "./http";

export const DAILY_CONTENT_CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

function errorResponse(status: number, code: string, message: string) {
  return json(
    { ok: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function handleDailyContent(request: Request): Promise<Response> {
  return guarded("api/daily-content", () => run(request));
}

async function run(request: Request): Promise<Response> {
  const dayParam = new URL(request.url).searchParams.get("day");
  const day = Number.parseInt(dayParam ?? "1", 10);

  if (!Number.isInteger(day) || day < 1 || day > 30) {
    return errorResponse(400, "invalid_day", "Day must be between 1 and 30");
  }

  let content;
  try {
    // Lazy import so a missing or broken database config is caught here too
    const { prisma } = await import("@/lib/prisma");
    content = await prisma.dailyContent.findUnique({
      where: { day },
      select: {
        day: true,
        ayahAr: true,
        ayahBn: true,
        ayahEn: true,
        ayahRef: true,
        hadithBn: true,
        hadithEn: true,
        hadithRef: true,
        duaAr: true,
        duaBn: true,
        duaEn: true,
        dayTaskBn: true,
        dayTaskEn: true,
      },
    });
  } catch (error) {
    console.error("[api/daily-content] database read failed", error);
    return errorResponse(503, "unavailable", "Daily content is temporarily unavailable");
  }

  if (!content) {
    return errorResponse(404, "not_found", "No content found for this day");
  }

  return json(
    { ok: true, data: content },
    { headers: { "Cache-Control": DAILY_CONTENT_CACHE_CONTROL } },
  );
}
