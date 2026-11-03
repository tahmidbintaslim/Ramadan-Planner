import { createFileRoute, redirect } from "@tanstack/react-router";

// Clerk handles sign-in (and password reset) at /sign-in.
export const Route = createFileRoute("/forgot")({
  beforeLoad: () => {
    throw redirect({ to: "/sign-in/$", params: { _splat: "" } });
  },
});
