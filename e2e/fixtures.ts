import { test as base, expect, type Page } from "@playwright/test";

// Console noise that does not come from the app: the Clerk dev-keys banner, and failed requests to hosts the
// test blocks (Clerk, Vercel) or external APIs. A failed same-origin request is NOT ignored unless it is an
// /api/* call (those widgets show their own error state when an upstream API or the database is missing) or
// Vercel Analytics' /_vercel/* script.
const IGNORED_TEXT = [
  /Clerk has been loaded with development keys/i,
  // clerk-js comes from the (fake) Clerk instance host, which the tests block.
  /^Clerk: Failed to load Clerk JS, failed to load script: https:\/\/[a-z0-9-]+\.clerk\.accounts\.dev\//,
];
export const HYDRATION = /hydrat|did not match|server rendered html|text content does not match/i;

export type ConsoleEntry = { type: string; text: string; url: string };

function isIgnored(entry: ConsoleEntry, origin: string): boolean {
  if (IGNORED_TEXT.some((r) => r.test(entry.text))) return true;
  if (/Failed to load resource|net::ERR_|ERR_FAILED/i.test(entry.text)) {
    if (!entry.url) return false;
    const u = new URL(entry.url);
    // /_vercel/* (Analytics) only exists on Vercel deployments.
    return u.origin !== origin || u.pathname.startsWith("/api/") || u.pathname.startsWith("/_vercel/");
  }
  return false;
}

export const BLOCKED_HOSTS = /clerk\.accounts\.dev|clerk\.com|clerk-telemetry|vercel/;

type Fixtures = {
  appLocale: "bn" | "en" | undefined;
  consoleEntries: ConsoleEntry[];
  /** Console errors/warnings and page errors that are not known external noise. */
  appErrors: () => ConsoleEntry[];
};

export const test = base.extend<Fixtures>({
  appLocale: [undefined, { option: true }],
  context: async ({ context, baseURL, appLocale }, provide) => {
    // Pretend a dev-browser, signed-out Clerk client so the fake-key server skips the Clerk handshake redirect.
    const cookies = [
      { name: "__clerk_db_jwt", value: "dvb_fake", url: baseURL! },
      { name: "__client_uat", value: "0", url: baseURL! },
    ];
    if (appLocale) cookies.push({ name: "NEXT_LOCALE", value: appLocale, url: baseURL! });
    await context.addCookies(cookies);
    // No network to Clerk/Vercel (fake keys): fail those requests fast.
    await context.route(BLOCKED_HOSTS, (r) => r.abort());
    await provide(context);
  },
  consoleEntries: async ({ page }, provide) => {
    const entries: ConsoleEntry[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning") entries.push({ type: m.type(), text: m.text(), url: m.location().url });
    });
    page.on("pageerror", (e) => entries.push({ type: "pageerror", text: e.message, url: "" }));
    await provide(entries);
  },
  appErrors: async ({ consoleEntries, baseURL }, provide) => {
    const origin = new URL(baseURL!).origin;
    await provide(() => consoleEntries.filter((e) => !isIgnored(e, origin)));
  },
});

/** Go to `path` and wait (bounded) for the network to settle. */
export async function visit(page: Page, path: string) {
  const res = await page.goto(path, { waitUntil: "load" });
  // Bounded idle wait: Chromium never reports a `Cache-Control: no-store` fetch as finished while its body is
  // unread, and some widgets skip the body of a non-OK answer.
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  return res;
}

export const LEAK = /prisma|127\.0\.0\.1|localhost:5432|ECONNREFUSED|Can't reach database/i;

export { expect };
