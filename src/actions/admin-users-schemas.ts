// Types and schemas shared by the admin-users server functions (client-safe: no server imports).
import { z } from "zod";

export type AdminUsersResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const addSchema = z.object({ userId: z.string().uuid() });
export const removeSchema = z.object({ userId: z.string().uuid() });
