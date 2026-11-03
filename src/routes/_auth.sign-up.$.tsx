import { createFileRoute } from "@tanstack/react-router";
import { SignUp } from "@clerk/tanstack-react-start";

export const Route = createFileRoute("/_auth/sign-up/$")({
  head: () => ({
    meta: [
      { title: "Create an account — Ramadan Planner" },
      { name: "description", content: "Create an account to start using Ramadan Planner." },
    ],
  }),
  component: () => (
    <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" forceRedirectUrl="/dashboard" />
  ),
});
