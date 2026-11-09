import { createFileRoute } from "@tanstack/react-router";
import { msg, pageHead, rootData } from "@/lib/seo";
import { SignIn } from "@clerk/tanstack-react-start";
import { ClerkGate } from "@/components/auth/clerk-unavailable";

export const Route = createFileRoute("/_auth/sign-in/$")({
  // Title in the UI language (was English in the Bengali UI, #48). The _auth layout keeps these pages noindex.
  head: ({ matches }) => pageHead({ matches, title: msg(rootData(matches), "auth", "login", "Sign in") }),
  component: () => (
    <ClerkGate mode="signIn">
      <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" fallbackRedirectUrl="/today" signUpFallbackRedirectUrl="/today" />
    </ClerkGate>
  ),
});
