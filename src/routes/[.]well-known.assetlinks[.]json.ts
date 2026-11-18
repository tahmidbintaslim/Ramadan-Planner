import { createFileRoute } from "@tanstack/react-router";
import { assetLinks } from "@/server/app-links";

// GET /.well-known/assetlinks.json (see src/server/app-links.ts).
export const Route = createFileRoute("/.well-known/assetlinks.json")({
  server: {
    handlers: {
      GET: () =>
        Response.json(assetLinks(process.env.ANDROID_CERT_SHA256), {
          headers: { "Cache-Control": "public, max-age=0, s-maxage=3600" },
        }),
    },
  },
});
