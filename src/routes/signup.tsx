import { createFileRoute } from "@tanstack/react-router";
import { SignUp } from "@clerk/tanstack-react-start";
import { AuthPage } from "@/components/auth/auth-page";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign up — Ramadan Planner" },
      { name: "description", content: "Create an account to start using Ramadan Planner." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AuthPage>
      <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" />
    </AuthPage>
  ),
});
