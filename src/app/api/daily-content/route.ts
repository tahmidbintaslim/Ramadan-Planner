import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    { ok: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: NextRequest) {
  const dayParam = request.nextUrl.searchParams.get("day");
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
    return errorResponse(
      503,
      "unavailable",
      "Daily content is temporarily unavailable",
    );
  }

  if (!content) {
    return errorResponse(404, "not_found", "No content found for this day");
  }

  return NextResponse.json({ ok: true, data: content }, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
