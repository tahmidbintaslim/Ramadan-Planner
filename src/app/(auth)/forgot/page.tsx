import { redirect } from "next/navigation";

export default function Page() {
  // Redirect to Clerk sign-in page; Clerk handles password reset flows from there.
  redirect("/sign-in");
}
