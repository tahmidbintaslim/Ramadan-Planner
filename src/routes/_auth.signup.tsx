import { createFileRoute, redirect } from "@tanstack/react-router";

// Clerk handles sign-up at /sign-up (an old /signup link must not render a second, unlabelled sign-up page).
export const Route = createFileRoute("/_auth/signup")({
  beforeLoad: () => {
    throw redirect({ to: "/sign-up/$", params: { _splat: "" } });
  },
});
