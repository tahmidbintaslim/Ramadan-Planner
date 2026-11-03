import { createFileRoute } from "@tanstack/react-router";
import { SignIn } from "@clerk/tanstack-react-start";

export const Route = createFileRoute("/_auth/sign-in/$")({
  head: () => ({
    meta: [
      { title: "Sign in — Ramadan Planner" },
      { name: "description", content: "Sign in to access your Ramadan Planner account." },
    ],
  }),
  component: () => <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" />,
});
