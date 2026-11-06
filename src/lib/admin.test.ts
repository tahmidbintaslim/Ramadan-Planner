import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { adminUser: { findUnique: m.findUnique } } }));

import { isUserAdmin } from "./admin";

const USER = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.stubEnv("ADMIN_EMAILS", "boss@example.com");
  m.findUnique.mockReset().mockResolvedValue(null);
});
afterEach(() => vi.unstubAllEnvs());

describe("isUserAdmin", () => {
  it("ADMIN_EMAILS matches only a verified email (case-insensitive)", async () => {
    expect(await isUserAdmin({ userId: USER, email: "Boss@Example.com", emailVerified: true })).toBe(true);
  });

  it("an unverified, or unknown-status, ADMIN_EMAILS address is not an admin", async () => {
    expect(await isUserAdmin({ userId: USER, email: "boss@example.com", emailVerified: false })).toBe(false);
    expect(await isUserAdmin({ userId: USER, email: "boss@example.com" })).toBe(false);
  });

  it("an AdminUser row grants access regardless of the email", async () => {
    m.findUnique.mockResolvedValue({ userId: USER });
    expect(await isUserAdmin({ userId: USER, email: null })).toBe(true);
    expect(m.findUnique).toHaveBeenCalledWith({ where: { userId: USER }, select: { userId: true } });
  });
});
