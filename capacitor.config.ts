import type { CapacitorConfig } from "@capacitor/cli";

// Thin native shell: the app loads the deployed site. native/www only holds the offline fallback page.
const config: CapacitorConfig = {
  appId: "space.tahmid.ramadanplanner",
  appName: "Ramadan Planner",
  webDir: "native/www",
  backgroundColor: "#F3F8F6",
  server: {
    url: "https://ramadanplanner.tahmid.space",
    errorPath: "index.html",
    // Same hosts as the Clerk and Stripe entries in the vercel.json CSP; anything else opens in the system browser.
    allowNavigation: [
      "ramadanplanner.tahmid.space",
      "*.clerk.accounts.dev",
      "clerk.ramadanplanner.tahmid.space",
      "checkout.stripe.com",
    ],
  },
  plugins: {
    // Light status bar icons over the teal bar set in android/app/src/main/res/values/styles.xml.
    SystemBars: { style: "DARK", insetsHandling: "native" },
  },
};

export default config;
