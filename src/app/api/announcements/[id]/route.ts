import { NextRequest, NextResponse } from "next/server";
import {
  deleteAnnouncementAction,
  saveAnnouncementAction,
} from "@/actions/announcements";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const res = await saveAnnouncementAction({ ...(body ?? {}), id });

  if (!res.ok) {
    const status = res.error === "unauthorized" ? 401 : res.error === "forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: res.error }, { status });
  }

  return NextResponse.json({ ok: true, data: res.data });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const res = await deleteAnnouncementAction(id);

  if (!res.ok) {
    const status = res.error === "unauthorized" ? 401 : res.error === "forbidden" ? 403 : 400;
    return NextResponse.json({ ok: false, error: res.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
