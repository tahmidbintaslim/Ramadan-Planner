// Account server functions: export my data, delete my account. POST behind `authMiddleware` (HTTP 401 when
// signed out); the bodies live in src/server/account-impl.ts and are stripped from the client bundle.
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/server/auth-middleware";
import { callAuthed } from "@/server/call-authed";
import { deleteAccountImpl, exportAccountDataImpl } from "@/server/account-impl";
import type { AccountResult } from "./account-schemas";

export type { AccountResult } from "./account-schemas";

const exportAccountDataFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(({ context }) => exportAccountDataImpl(context.userId));

const deleteAccountFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(({ context }) => deleteAccountImpl(context.userId, context.clerkId));

export async function exportAccountDataAction(): Promise<AccountResult<string>> {
  return callAuthed(() => exportAccountDataFn());
}

export async function deleteAccountAction(): Promise<AccountResult<null>> {
  return callAuthed(() => deleteAccountFn());
}
