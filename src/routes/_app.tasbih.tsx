import { createFileRoute } from "@tanstack/react-router";
import { navHead } from "@/lib/seo";
import { TasbihContent } from "@/components/tasbih/tasbih-content";

export const Route = createFileRoute("/_app/tasbih")({ head: navHead("tasbih"), component: TasbihContent });
