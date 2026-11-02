import { createFileRoute } from "@tanstack/react-router";
import { SignUp } from "@clerk/tanstack-react-start";

export const Route = createFileRoute("/_auth/signup")({
  head: () => ({
    meta: [
      { title: "Sign up — Ramadan Planner" },
      { name: "description", content: "Create an account to start using Ramadan Planner." },
    ],
  }),
  component: () => <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" />,
});
