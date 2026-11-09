import { createFileRoute } from "@tanstack/react-router";
import { msg, pageHead, rootData } from "@/lib/seo";
import { SignUp } from "@clerk/tanstack-react-start";
import { ClerkGate } from "@/components/auth/clerk-unavailable";

export const Route = createFileRoute("/_auth/sign-up/$")({
  // Title in the UI language (was English in the Bengali UI, #48). The _auth layout keeps these pages noindex.
  head: ({ matches }) => pageHead({ matches, title: msg(rootData(matches), "auth", "signup", "Create an account") }),
  component: () => (
    <ClerkGate mode="signUp">
      <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" forceRedirectUrl="/today" />
    </ClerkGate>
  ),
});
