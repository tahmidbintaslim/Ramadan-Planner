import { describe, expect, it, vi } from "vitest";
import { handleUsageEvent, type UsageEventDeps } from "./usage-events";

const post = (body: unknown, deps: UsageEventDeps) =>
  handleUsageEvent(new Request("https://app.example/api/events", { method: "POST", body: JSON.stringify(body) }), deps);

describe("POST /api/events", () => {
  it("stores a known event with a clean path, the locale and the signed-in user id", async () => {
    const insert = vi.fn(async () => ({}));
    const res = await post({ name: "page_view", path: "/quran/36?x=1#a", locale: "bn" }, { getUserId: async () => "u1", insert });
    expect(res.status).toBe(204);
    expect(insert).toHaveBeenCalledWith({ name: "page_view", path: "/quran/36", locale: "bn", userId: "u1" });
  });

  it("stores guests without an id", async () => {
    const insert = vi.fn(async () => ({}));
    await post({ name: "reminder_added", path: "/reminders" }, { getUserId: async () => null, insert });
    expect(insert).toHaveBeenCalledWith({ name: "reminder_added", path: "/reminders", locale: "", userId: null });
  });

  it("rejects unknown names, odd paths and junk without writing", async () => {
    const insert = vi.fn(async () => ({}));
    const deps = { getUserId: async () => null, insert };
    for (const body of [{ name: "drop_table", path: "/" }, { name: "page_view", path: "https://evil" }, { name: "page_view", path: "/a b" }, null]) {
      expect((await post(body, deps)).status).toBe(400);
    }
    expect(insert).not.toHaveBeenCalled();
  });
});
