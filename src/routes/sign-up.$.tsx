import { createFileRoute } from "@tanstack/react-router";
import { SignUp } from "@clerk/tanstack-react-start";
import { AuthPage } from "@/components/auth/auth-page";

export const Route = createFileRoute("/sign-up/$")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: () => (
    <AuthPage>
      <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" forceRedirectUrl="/dashboard" />
    </AuthPage>
  ),
});
