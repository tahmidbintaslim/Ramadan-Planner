import { createFileRoute } from "@tanstack/react-router";
import { TasbihContent } from "@/components/tasbih/tasbih-content";

export const Route = createFileRoute("/_app/tasbih")({ component: TasbihContent });
