import { createFileRoute } from "@tanstack/react-router";
import { TodayContent } from "@/components/today/today-content";

export const Route = createFileRoute("/_app/today")({ component: TodayContent });
