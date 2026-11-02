import { createFileRoute } from "@tanstack/react-router";
import { navHead } from "@/lib/seo";
import { ZakatContent } from "@/components/zakat/zakat-content";

export const Route = createFileRoute("/_app/zakat")({ head: navHead("zakat"), component: ZakatContent });
