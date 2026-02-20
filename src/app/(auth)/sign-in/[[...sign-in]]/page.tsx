import { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Sign in — Ramadan Planner",
  description: "Sign in to access your Ramadan Planner account.",
};

export default function Page() {
  return <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" />;
}
