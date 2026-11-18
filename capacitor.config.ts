import type { CapacitorConfig } from "@capacitor/cli";

// iOS shell: the app loads the deployed site; native/www only holds the offline fallback page. Android is a
// Trusted Web Activity in android/ (docs/apps.md).
const config: CapacitorConfig = {
  appId: "space.tahmid.ramadanplanner",
  appName: "Ramadan Planner",
  webDir: "native/www",
  backgroundColor: "#F3F8F6",
  server: {
    url: "https://ramadanplanner.tahmid.space",
    errorPath: "index.html",
    // The site and Clerk's sign-in hosts; anything else opens in the system browser. No Stripe: the apps show no
    // donation links.
    allowNavigation: [
      "ramadanplanner.tahmid.space",
      "clerk.ramadanplanner.tahmid.space",
      "accounts.ramadanplanner.tahmid.space",
      "*.clerk.accounts.dev",
    ],
  },
  // Marks the app for the site (see the pre-paint script in src/routes/__root.tsx): donation links stay hidden.
  ios: {
    appendUserAgent: "RamadanPlannerApp/ios",
    // Service worker (offline pages) in WKWebView; the domains are WKAppBoundDomains in ios/App/App/Info.plist.
    // Sign-in then needs Clerk's production hosts (clerk./accounts.ramadanplanner.tahmid.space), not the dev host.
    limitsNavigationsToAppBoundDomains: true,
  },
  plugins: {
    // Light status bar icons over the teal bar.
    SystemBars: { style: "DARK", insetsHandling: "native" },
  },
};

export default config;
