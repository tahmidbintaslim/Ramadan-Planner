import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/providers/auth-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "রমজান প্ল্যানার | Ramadan Planner",
  description:
    "আপনার রমজান যাত্রা পরিকল্পনা করুন — দৈনিক ইবাদত ট্র্যাক করুন, নামাজের সময় জানুন। Plan your Ramadan journey — track daily ibadah, get prayer times.",
  openGraph: {
    title: "রমজান প্ল্যানার | Ramadan Planner",
    description:
      "দৈনিক ইবাদত ট্র্যাক করুন, নামাজের সময় জানুন, এবং রমজানে আপনার ঈমানকে শক্তিশালী করুন",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>{children}</AuthProvider>
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
