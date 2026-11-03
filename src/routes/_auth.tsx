import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/auth/auth-page";

// Pathless layout replacing the old src/app/(auth)/layout.tsx: centered card, noindex.
export const Route = createFileRoute("/_auth")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: () => (
    <AuthPage>
      <Outlet />
    </AuthPage>
  ),
});
