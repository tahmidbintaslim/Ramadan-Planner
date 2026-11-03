import type { ReactNode } from "react";
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { ClerkProvider } from "@clerk/tanstack-react-start";
import { Analytics } from "@vercel/analytics/react";
import appCss from "@/styles/globals.css?url";
import { getLocaleAndMessages } from "@/i18n/load";
import { AppIntlProvider } from "@/i18n/provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AccessibilitySidebar } from "@/components/shared/accessibility-sidebar";
import { NotFound } from "@/components/shared/not-found";
import { Toaster } from "@/components/ui/sonner";

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
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title },
        { name: "description", content: common?.metaDescription ?? "" },
        { property: "og:title", content: title },
        { property: "og:description", content: common?.metaOgDescription ?? "" },
        { property: "og:type", content: "website" },
        // Light value; ThemeColorSync switches it to the Night value (#0B1F24) when the .dark class is active.
        { name: "theme-color", content: "#F3F8F6" },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "icon", href: "/favicon.ico", sizes: "any" },
        { rel: "manifest", href: "/manifest.webmanifest" },
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
