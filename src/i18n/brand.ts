import type { AbstractIntlMessages } from "use-intl";

/**
 * Brand mentions inside other messages are written as this token and filled from `common.appName` when the
 * messages load, so the app name (and its Bengali spelling) lives in one key per language.
 */
export const APP_NAME_TOKEN = "{appName}";

function fill(value: AbstractIntlMessages | string, appName: string): AbstractIntlMessages | string {
  if (typeof value === "string") return value.split(APP_NAME_TOKEN).join(appName);
  const out: AbstractIntlMessages = {};
  for (const [k, v] of Object.entries(value)) out[k] = fill(v as AbstractIntlMessages | string, appName);
  return out;
}

/** The messages with every APP_NAME_TOKEN replaced by `common.appName` (unchanged when there is no app name). */
export function withBrand<T extends AbstractIntlMessages>(messages: T): T {
  const common = messages.common as Record<string, unknown> | undefined;
  const appName = typeof common?.appName === "string" ? common.appName : null;
  if (!appName) return messages;
  return fill(messages, appName) as T;
}
