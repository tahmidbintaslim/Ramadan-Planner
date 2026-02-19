import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const dayParam = request.nextUrl.searchParams.get("day");
  const day = Number.parseInt(dayParam ?? "1", 10);

  if (!Number.isInteger(day) || day < 1 || day > 30) {
    return NextResponse.json({ ok: false, error: "Invalid day" }, { status: 400 });
  }

  const content = await prisma.dailyContent.findUnique({
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

  if (!content) {
    return NextResponse.json({ ok: false, error: "No content found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: content }, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
