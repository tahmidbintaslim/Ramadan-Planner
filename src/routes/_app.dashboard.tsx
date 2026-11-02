import { createFileRoute } from "@tanstack/react-router";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export const Route = createFileRoute("/_app/dashboard")({ component: DashboardContent });
