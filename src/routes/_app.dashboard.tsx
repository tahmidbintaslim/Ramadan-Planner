import { createFileRoute } from "@tanstack/react-router";
import { navHead } from "@/lib/seo";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export const Route = createFileRoute("/_app/dashboard")({ head: navHead("dashboard"), component: DashboardContent });
