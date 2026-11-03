import { createFileRoute } from "@tanstack/react-router";
import { navHead } from "@/lib/seo";
import { RemindersContent } from "@/components/reminders/reminders-content";

export const Route = createFileRoute("/_app/reminders")({ head: navHead("reminders"), component: RemindersContent });
