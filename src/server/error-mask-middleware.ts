// Global server-function middleware (registered in src/start.ts). Start serializes `Error.message` to the client
// (with HTTP 200) for anything a handler throws; Next.js used to mask these in production. Only deliberate,
// safe errors get through; everything else is logged here and replaced by a generic `internal_error`.
import { createMiddleware } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { isNotFound, isRedirect } from "@tanstack/react-router";
import {
  AUTH_UNAVAILABLE_MESSAGE,
  INTERNAL_ERROR_MESSAGE,
  UNAUTHORIZED_MESSAGE,
} from "./errors";

const SAFE_MESSAGES = new Set([UNAUTHORIZED_MESSAGE, AUTH_UNAVAILABLE_MESSAGE, INTERNAL_ERROR_MESSAGE]);

export function isSafeError(error: unknown): boolean {
  if (isRedirect(error) || isNotFound(error)) return true;
  return error instanceof Error && SAFE_MESSAGES.has(error.message);
}

export const errorMaskMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (isSafeError(error)) throw error;
    console.error("[server function] unhandled error", error);
    setResponseStatus(500);
    throw new Error(INTERNAL_ERROR_MESSAGE);
  }
});
