import type { ReactNode } from "react";
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { ClerkProvider } from "@clerk/tanstack-react-start";
import { Analytics } from "@vercel/analytics/react";
import appCss from "@/styles/globals.css?url";
// The one font worth preloading per locale: the display/UI face every screen paints first (titles, rows, times).
// Same file the stylesheet's @font-face points at, so Vite emits it once. Bengali: Anek Bangla variable, bengali
// subset (every weight in one file).
import uiFontBn from "@fontsource-variable/anek-bangla/files/anek-bangla-bengali-wght-normal.woff2?url";
// English pages: Figtree variable, latin subset.
import uiFontLatin from "@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2?url";
import { getLocaleAndMessages } from "@/i18n/load";
import { AppIntlProvider } from "@/i18n/provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AccessibilitySidebar } from "@/components/shared/accessibility-sidebar";
import { NotFound } from "@/components/shared/not-found";
import { Toaster } from "@/components/ui/sonner";

const THEME_COLOR_SCRIPT = `try{var t=localStorage.getItem("theme");var d=t==="dark"||((!t||t==="system")&&matchMedia("(prefers-color-scheme: dark)").matches);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",d?"#0B1A17":"#F4F7F6")}catch(e){}`;

export const Route = createRootRoute({
  loader: () => getLocaleAndMessages(),
  // Messages never go stale on their own; a locale switch calls router.invalidate() to reload.
  staleTime: Infinity,
  head: ({ loaderData }) => {
    const common = (loaderData?.messages as { common?: Record<string, string> } | undefined)?.common;
    const title = common?.metaTitle ?? "Ramadan Planner";
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        { title },
        { name: "description", content: common?.metaDescription ?? "" },
        { property: "og:title", content: title },
        { property: "og:description", content: common?.metaOgDescription ?? "" },
        { property: "og:type", content: "website" },
        // Light value; ThemeColorSync switches it to the Night value (#0B1A17) when the .dark class is active.
        { name: "theme-color", content: "#F4F7F6" },
      ],
      links: [
        {
          rel: "preload",
          href: loaderData?.locale === "en" ? uiFontLatin : uiFontBn,
          as: "font",
          type: "font/woff2",
          crossOrigin: "anonymous",
        },
        { rel: "stylesheet", href: appCss },
        { rel: "icon", href: "/favicon.ico", sizes: "any" },
        { rel: "manifest", href: "/manifest.webmanifest", crossOrigin: "use-credentials" },
        { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
      ],
    };
  },
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
});

function RootDocument({ children }: { children: ReactNode }) {
  const { locale, messages } = Route.useLoaderData();
  return (
    // suppressHydrationWarning: next-themes sets the theme class on <html> before hydration.
    <html lang={locale} suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Before hydration: next-themes' own script sets the .dark class; this sets the matching theme-color. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_COLOR_SCRIPT }} />
      </head>
      <body className="antialiased bg-background text-foreground">
        <ClerkProvider>
          <AppIntlProvider locale={locale} messages={messages}>
            <ThemeProvider>
              <AuthProvider>{children}</AuthProvider>
              <AccessibilitySidebar />
              <Toaster />
            </ThemeProvider>
          </AppIntlProvider>
        </ClerkProvider>
        <Analytics />
        <Scripts />
      </body>
    </html>
  );
}
