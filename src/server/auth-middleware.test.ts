import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, getUser, upsert, setResponseStatus, setResponseHeader } = vi.hoisted(() => ({
  setResponseHeader: vi.fn(),
  auth: vi.fn(),
  getUser: vi.fn(),
  upsert: vi.fn(),
  setResponseStatus: vi.fn(),
}));
vi.mock("@clerk/tanstack-react-start/server", () => ({
  auth,
  clerkClient: () => ({ users: { getUser } }),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { userProfile: { upsert } } }));
vi.mock("@tanstack/react-start/server", () => ({ setResponseStatus, setResponseHeader }));

import { authMiddleware } from "./auth-middleware";

type ServerFn = (ctx: { next: (opts: unknown) => unknown }) => Promise<unknown>;
const run = (next: (opts: unknown) => unknown) =>
  (authMiddleware.options.server as unknown as ServerFn)({ next });

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ primaryEmailAddress: { emailAddress: "a@example.com" } });
});

describe("authMiddleware", () => {
  it("signed out: sets HTTP 401, throws Unauthorized and never calls the handler", async () => {
    auth.mockResolvedValue({ isAuthenticated: false, userId: null });
    const next = vi.fn();
    await expect(run(next)).rejects.toThrow("Unauthorized");
    expect(setResponseStatus).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("signed in: ensures the profile and passes userId (the app UUID) in context", async () => {
    auth.mockResolvedValue({ isAuthenticated: true, userId: "user_123" });
    const next = vi.fn().mockResolvedValue("handler-result");
    await expect(run(next)).resolves.toBe("handler-result");
    expect(next).toHaveBeenCalledWith({ context: { userId: "db99edd8-fa85-5bc2-95ec-a499147bb210" } });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(setResponseStatus).not.toHaveBeenCalled();
    expect(setResponseHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
  });

  it("does not call the Clerk Backend API per call (getAppAuthUser withEmail: false)", async () => {
    auth.mockResolvedValue({ isAuthenticated: true, userId: "user_123" });
    await run(vi.fn().mockResolvedValue("ok"));
    expect(getUser).not.toHaveBeenCalled();
  });

  it("passes { ensureProfile: true, withEmail: false } to getAppAuthUser", async () => {
    vi.resetModules();
    const getAppAuthUser = vi.fn().mockResolvedValue({ id: "u", clerkId: "c", email: null });
    vi.doMock("@/lib/auth/server", () => ({ getAppAuthUser }));
    const mod = await import("./auth-middleware");
    const next = vi.fn().mockResolvedValue("ok");
    await (mod.authMiddleware.options.server as unknown as ServerFn)({ next });
    expect(getAppAuthUser).toHaveBeenCalledWith({ ensureProfile: true, withEmail: false });
    vi.doUnmock("@/lib/auth/server");
  });

  it("auth backend failure: HTTP 503 and a generic error; the backend's message never reaches the client", async () => {
    const secretish = "Clerk: Unable to authenticate request (sk_test_xxx, instance fake-test-instance) 500";
    auth.mockRejectedValue(new Error(secretish));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const next = vi.fn();
    const error = await run(next).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("auth_unavailable");
    expect(String((error as Error).stack ?? "")).not.toContain("sk_test_xxx");
    expect(JSON.stringify(error, Object.getOwnPropertyNames(error))).not.toContain(secretish);
    expect((error as Error).cause).toBeUndefined();
    expect(setResponseStatus).toHaveBeenCalledWith(503);
    expect(setResponseStatus).not.toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("Prisma upsert failure is also wrapped (503, generic message)", async () => {
    auth.mockResolvedValue({ isAuthenticated: true, userId: "user_123" });
    upsert.mockRejectedValue(new Error("PrismaClientInitializationError: Can't reach database server at db.internal:5432"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(run(vi.fn())).rejects.toThrow(/^auth_unavailable$/);
    expect(setResponseStatus).toHaveBeenCalledWith(503);
    consoleError.mockRestore();
  });
});
