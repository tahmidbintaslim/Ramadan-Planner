import { createFileRoute } from "@tanstack/react-router";
import { navHead } from "@/lib/seo";
import { TodayContent } from "@/components/today/today-content";

export const Route = createFileRoute("/_app/today")({ head: navHead("today"), component: TodayContent });
