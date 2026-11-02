import { createFileRoute } from "@tanstack/react-router";
import { ZakatContent } from "@/components/zakat/zakat-content";

export const Route = createFileRoute("/_app/zakat")({ component: ZakatContent });
