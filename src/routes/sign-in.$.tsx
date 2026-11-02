import { createFileRoute } from "@tanstack/react-router";
import { SignIn } from "@clerk/tanstack-react-start";
import { AuthPage } from "@/components/auth/auth-page";

export const Route = createFileRoute("/sign-in/$")({
  head: () => ({
    meta: [
      { title: "Sign in — Ramadan Planner" },
      { name: "description", content: "Sign in to access your Ramadan Planner account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AuthPage>
      <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" />
    </AuthPage>
  ),
});
