import { NextRequest, NextResponse } from "next/server";
import {
  listActiveAnnouncementsAction,
  saveAnnouncementAction,
} from "@/actions/announcements";

export async function GET() {
  try {
    const res = await listActiveAnnouncementsAction();
    if (res.ok) {
      return NextResponse.json({ ok: true, data: res.data });
    }
  } catch (error) {
    console.error("[api/announcements] database read failed", error);
  }

  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "unavailable",
        message: "Announcements are temporarily unavailable",
      },
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const res = await saveAnnouncementAction(body);

  if (!res.ok) {
    const status = res.error === "unauthorized" ? 401 : res.error === "forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: res.error }, { status });
  }

  return NextResponse.json({ ok: true, data: res.data });
}
