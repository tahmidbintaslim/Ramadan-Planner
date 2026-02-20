import { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Sign up — Ramadan Planner",
  description: "Create an account to start using Ramadan Planner.",
};

export default function Page() {
  return <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" />;
}
