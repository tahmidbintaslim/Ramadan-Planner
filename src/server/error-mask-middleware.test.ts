import { beforeEach, describe, expect, it, vi } from "vitest";
import { notFound, redirect } from "@tanstack/react-router";

const { setResponseStatus } = vi.hoisted(() => ({ setResponseStatus: vi.fn() }));
vi.mock("@tanstack/react-start/server", () => ({ setResponseStatus }));

import { errorMaskMiddleware } from "./error-mask-middleware";

type ServerFn = (ctx: { next: () => unknown }) => Promise<unknown>;
const run = (next: () => unknown) => (errorMaskMiddleware.options.server as unknown as ServerFn)({ next });

const PRISMA_TEXT =
  "Invalid `prisma.announcement.update()` invocation: Can't reach database server at 127.0.0.1:5432 where: { id: 'x' } table public.announcements";

beforeEach(() => vi.clearAllMocks());

describe("errorMaskMiddleware", () => {
  it("returns the handler result untouched", async () => {
    await expect(run(async () => "ok")).resolves.toBe("ok");
    expect(setResponseStatus).not.toHaveBeenCalled();
  });

  it("masks a Prisma-shaped error: internal_error, HTTP 500, no original text anywhere, logged server-side", async () => {
    const original = new Error(PRISMA_TEXT);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const thrown = (await run(async () => {
      throw original;
    }).catch((e: unknown) => e)) as Error;
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown.message).toBe("internal_error");
    expect((thrown as Error & { cause?: unknown }).cause).toBeUndefined();
    const dump = `${thrown.message}\n${thrown.stack}\n${JSON.stringify(thrown, Object.getOwnPropertyNames(thrown))}`;
    for (const s of ["prisma", "127.0.0.1", "5432", "announcements", "where"]) expect(dump).not.toContain(s);
    expect(setResponseStatus).toHaveBeenCalledWith(500);
    expect(spy).toHaveBeenCalledWith(expect.any(String), original);
    spy.mockRestore();
  });

  it("masks non-Error throws and plain objects too", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(run(async () => { throw "secret-string"; })).rejects.toThrow("internal_error");
    await expect(run(async () => { throw { message: "Unauthorized" }; })).rejects.toThrow("internal_error");
  });

  it("lets deliberate errors through unchanged, with no status change and no log", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = redirect({ to: "/login" });
    const nf = notFound();
    const un = new Error("Unauthorized");
    const au = new Error("auth_unavailable");
    const ie = new Error("internal_error");
    for (const e of [r, nf, un, au, ie]) {
      await expect(run(async () => { throw e; })).rejects.toBe(e);
    }
    expect(setResponseStatus).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
