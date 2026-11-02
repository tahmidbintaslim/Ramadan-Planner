import type { ReactNode } from "react";

// Port of the old src/app/(auth)/layout.tsx wrapper. FloatingQuickNav is added back when Task 4/5 ports it.
export function AuthPage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
