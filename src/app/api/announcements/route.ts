import { NextRequest, NextResponse } from "next/server";
import {
  listActiveAnnouncementsAction,
  saveAnnouncementAction,
} from "@/actions/announcements";

export async function GET() {
  const res = await listActiveAnnouncementsAction();
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, data: res.data });
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
