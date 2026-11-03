import type { ReactNode } from "react";
import { FloatingQuickNav } from "@/components/shared/floating-quick-nav";

// Port of the old src/app/(auth)/layout.tsx wrapper (rendered by the pathless `_auth` layout route).
export function AuthPage({ children }: { children: ReactNode }) {
  return (
    <>
      {/* pb-24 keeps the end of a tall form scrollable above the floating accessibility button. */}
      <div className="min-h-screen flex items-center justify-center bg-background px-4 pt-10 pb-24">
        <div className="w-full max-w-md">{children}</div>
      </div>
      <FloatingQuickNav />
    </>
  );
}
