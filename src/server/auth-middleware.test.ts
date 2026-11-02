import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, getUser, upsert, setResponseStatus } = vi.hoisted(() => ({
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
vi.mock("@tanstack/react-start/server", () => ({ setResponseStatus }));

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
  });
});
