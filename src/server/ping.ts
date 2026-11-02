// TEMPORARY (Task 3): remove or promote in Task 8 / billing Part C
// Diagnostic server function used only to test the auth boundary (401 when signed out, CSRF 403).
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "./auth-middleware";

export const ping = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(() => ({ ok: true }));
