import { createFileRoute } from "@tanstack/react-router";
import { RemindersContent } from "@/components/reminders/reminders-content";

export const Route = createFileRoute("/_app/reminders")({ component: RemindersContent });
