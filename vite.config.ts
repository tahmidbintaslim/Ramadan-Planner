import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

// Public keys the client bundle reads from import.meta.env.VITE_*. Deployments that still only define the
// Next.js-era names (NEXT_PUBLIC_*) get them mapped here at build time, so a missing rename in the Vercel
// project does not break sign-in or push. Only public (publishable) values are mapped; never secrets.
const PUBLIC_FALLBACKS: Record<string, string> = {
  VITE_CLERK_PUBLISHABLE_KEY: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  VITE_VAPID_PUBLIC_KEY: "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
};

// Nitro picks its preset from NITRO_PRESET (CI and Vercel builds use NITRO_PRESET=vercel -> .vercel/output);
// without it the build is a Node server in .output/.
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const define: Record<string, string> = {};
  for (const [target, legacy] of Object.entries(PUBLIC_FALLBACKS)) {
    if (!env[target] && env[legacy]) define[`import.meta.env.${target}`] = JSON.stringify(env[legacy]);
  }
  return {
    // Resolves the "@/*" alias from tsconfig.json.
    resolve: { tsconfigPaths: true },
    define,
    plugins: [
      nitro({
        // Node server builds (no NITRO_PRESET): pre-compress the static assets (JS, CSS, fonts) as .br/.gz, served
        // when the browser accepts them. Vercel compresses on its CDN, so its build skips this. HTML responses
        // are rendered per request and stay uncompressed on the Node server.
        compressPublicAssets: env.NITRO_PRESET || env.VERCEL ? false : { gzip: true, brotli: true },
      }),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ],
  };
});
