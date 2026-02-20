import type { Metadata } from "next";
import { FloatingQuickNav } from "@/components/shared/floating-quick-nav";

export const metadata: Metadata = {
  robots: "noindex",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">{children}</div>
      </div>
      <FloatingQuickNav />
    </>
  );
}
