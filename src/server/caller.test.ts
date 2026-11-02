import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAppAuthUser, setResponseStatus } = vi.hoisted(() => ({ getAppAuthUser: vi.fn(), setResponseStatus: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ getAppAuthUser }));
vi.mock("@tanstack/react-start/server", () => ({ setResponseStatus }));

import { getCallerWithEmail } from "./caller";

beforeEach(() => vi.clearAllMocks());

describe("getCallerWithEmail", () => {
  it("returns the user when the session matches, null otherwise", async () => {
    getAppAuthUser.mockResolvedValue({ id: "u1", clerkId: "c", email: "a@b.c" });
    expect(await getCallerWithEmail("u1")).toMatchObject({ id: "u1", email: "a@b.c" });
    expect(await getCallerWithEmail("u2")).toBeNull();
    getAppAuthUser.mockResolvedValue(null);
    expect(await getCallerWithEmail("u1")).toBeNull();
  });

  it("a Clerk failure becomes a generic auth_unavailable (503), logged, with no original text or cause", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    getAppAuthUser.mockRejectedValue(new Error("Clerk: rate limited, key sk_test_xxx"));
    const thrown = (await getCallerWithEmail("u1").catch((e: unknown) => e)) as Error;
    expect(thrown.message).toBe("auth_unavailable");
    expect((thrown as Error & { cause?: unknown }).cause).toBeUndefined();
    expect(`${thrown.stack}${JSON.stringify(thrown, Object.getOwnPropertyNames(thrown))}`).not.toContain("sk_test_xxx");
    expect(setResponseStatus).toHaveBeenCalledWith(503);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
