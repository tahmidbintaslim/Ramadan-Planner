import { describe, expect, it } from "vitest";
import { isUnauthorized } from "./errors";

describe("isUnauthorized", () => {
  it("recognises the auth middleware rejection as Start surfaces it", () => {
    // Client RPC: Start deserializes the thrown Error and rethrows it; SSR: the same Error directly.
    expect(isUnauthorized(new Error("Unauthorized"))).toBe(true);
    // A deserialized error-like object (seroval may not keep the prototype in every path).
    expect(isUnauthorized({ name: "Error", message: "Unauthorized" })).toBe(true);
    // A raw 401 Response, or an error object carrying the status.
    expect(isUnauthorized(new Response("Unauthorized", { status: 401 }))).toBe(true);
    expect(isUnauthorized({ status: 401 })).toBe(true);
    expect(isUnauthorized({ statusCode: 401 })).toBe(true);
  });

  it("does not swallow other errors", () => {
    expect(isUnauthorized(new Error("auth_unavailable"))).toBe(false);
    expect(isUnauthorized(new Error("Unauthorized access to database"))).toBe(false);
    expect(isUnauthorized(new Error("unauthorized"))).toBe(false);
    expect(isUnauthorized(new TypeError("Failed to fetch"))).toBe(false);
    expect(isUnauthorized(new Response("Forbidden", { status: 403 }))).toBe(false);
    expect(isUnauthorized(new Response("x", { status: 503 }))).toBe(false);
    expect(isUnauthorized({ status: 500 })).toBe(false);
    expect(isUnauthorized("Unauthorized")).toBe(false);
    expect(isUnauthorized(null)).toBe(false);
    expect(isUnauthorized(undefined)).toBe(false);
  });
});
