import type { ReactNode } from "react";
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { ClerkProvider } from "@clerk/tanstack-react-start";
import appCss from "@/styles/globals.css?url";
import { getLocaleAndMessages } from "@/i18n/load";
import { AppIntlProvider } from "@/i18n/provider";

// Minimal shell; the real layout (theme, analytics) is ported in later tasks.
export const Route = createRootRoute({
  loader: () => getLocaleAndMessages(),
  // Messages never go stale on their own; a locale switch calls router.invalidate() to reload.
  staleTime: Infinity,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Ramadan Planner" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  const { locale, messages } = Route.useLoaderData();
  return (
    <html lang={locale}>
      <head>
        <HeadContent />
      </head>
      <body>
        <ClerkProvider>
          <AppIntlProvider locale={locale} messages={messages}>
            {children}
          </AppIntlProvider>
        </ClerkProvider>
        <Scripts />
      </body>
    </html>
  );
}
