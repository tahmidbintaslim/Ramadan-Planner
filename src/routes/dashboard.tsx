import { createFileRoute, redirect } from "@tanstack/react-router";

// The old dashboard duplicated the Home: old links and bookmarks go to /today (permanent, so it is not indexed).
export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => {
    throw redirect({ to: "/today", statusCode: 301 });
  },
});
