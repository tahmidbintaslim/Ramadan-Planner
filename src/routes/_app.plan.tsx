import { createFileRoute } from "@tanstack/react-router";
import { PlanContent } from "@/components/plan/plan-content";

export const Route = createFileRoute("/_app/plan")({ component: PlanContent });
