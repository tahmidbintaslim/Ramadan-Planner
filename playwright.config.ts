import { defineConfig, devices } from "@playwright/test";

// End-to-end smoke tests against the BUILT Node server (`npm run build`, then `npm start`).
// The server needs placeholder env only (see .github/workflows/ci.yml): DATABASE_URL pointing nowhere and
// clearly fake Clerk keys. Never put real keys here or in the repository.
//   npm run build && npm run test:e2e         (starts the server on :3001 unless one is already running)
//   PWCHROME=/usr/bin/google-chrome ...        (use a system Chrome instead of Playwright's download)
//   E2E_NETWORK=1 ...                          (also run the checks that need quranapi.pages.dev / aladhan.com)
const PORT = Number(process.env.E2E_PORT ?? 3001);
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 900 },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
        // A Bengali browser by default, so cookie-less tests see the Bengali UI (first visits follow Accept-Language).
        locale: "bn-BD",
        launchOptions: {
          executablePath: process.env.PWCHROME || undefined,
          // Talk to localhost directly even when the shell has an HTTPS proxy configured.
          args: ["--no-proxy-server"],
        },
      },
    },
  ],
  webServer: {
    command: "node .output/server/index.mjs",
    url: `${BASE_URL}/robots.txt`,
    env: { PORT: String(PORT) },
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
