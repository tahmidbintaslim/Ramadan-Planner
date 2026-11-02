import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, getUser, clerkClient, upsert } = vi.hoisted(() => {
  const getUser = vi.fn();
  return {
    auth: vi.fn(),
    getUser,
    clerkClient: vi.fn(() => ({ users: { getUser } })),
    upsert: vi.fn(),
  };
});
vi.mock("@clerk/tanstack-react-start/server", () => ({ auth, clerkClient }));
vi.mock("@/lib/prisma", () => ({ prisma: { userProfile: { upsert } } }));

import { getAppAuthUser } from "./server";

const CLERK_ID = "user_123";
const UUID = "db99edd8-fa85-5bc2-95ec-a499147bb210"; // pinned in uuid.test.ts

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ primaryEmailAddress: { emailAddress: "a@example.com" }, emailAddresses: [] });
});

describe("getAppAuthUser", () => {
  it("returns null when signed out without touching the Clerk backend or Prisma", async () => {
    auth.mockResolvedValue({ isAuthenticated: false, userId: null });
    await expect(getAppAuthUser({ ensureProfile: true })).resolves.toBeNull();
    expect(clerkClient).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("maps the Clerk id to the pinned UUID and does not upsert by default", async () => {
    auth.mockResolvedValue({ isAuthenticated: true, userId: CLERK_ID });
    await expect(getAppAuthUser()).resolves.toEqual({ id: UUID, clerkId: CLERK_ID, email: "a@example.com" });
    await getAppAuthUser({ ensureProfile: false });
    expect(getUser).toHaveBeenCalledWith(CLERK_ID);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("upserts the profile exactly once with ensureProfile", async () => {
    auth.mockResolvedValue({ isAuthenticated: true, userId: CLERK_ID });
    await getAppAuthUser({ ensureProfile: true });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith({ where: { id: UUID }, create: { id: UUID }, update: {} });
  });

  it("withEmail: false skips the Clerk Backend lookup (email null) but still maps and upserts", async () => {
    auth.mockResolvedValue({ isAuthenticated: true, userId: CLERK_ID });
    await expect(getAppAuthUser({ ensureProfile: true, withEmail: false })).resolves.toEqual({
      id: UUID,
      clerkId: CLERK_ID,
      email: null,
    });
    expect(clerkClient).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("withEmail defaults to true and can be set explicitly", async () => {
    auth.mockResolvedValue({ isAuthenticated: true, userId: CLERK_ID });
    expect((await getAppAuthUser({ withEmail: true }))?.email).toBe("a@example.com");
    expect((await getAppAuthUser({ ensureProfile: false }))?.email).toBe("a@example.com");
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it("falls back to the first email address, then null", async () => {
    auth.mockResolvedValue({ isAuthenticated: true, userId: CLERK_ID });
    getUser.mockResolvedValueOnce({ primaryEmailAddress: null, emailAddresses: [{ emailAddress: "b@example.com" }] });
    expect((await getAppAuthUser())?.email).toBe("b@example.com");
    getUser.mockResolvedValueOnce({ primaryEmailAddress: null, emailAddresses: [] });
    expect((await getAppAuthUser())?.email).toBeNull();
  });
});
