import { createFileRoute } from "@tanstack/react-router";
import { navHead } from "@/lib/seo";
import { PlanContent } from "@/components/plan/plan-content";

export const Route = createFileRoute("/_app/plan")({ head: navHead("plan"), component: PlanContent });
