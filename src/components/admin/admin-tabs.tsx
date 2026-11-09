import { Link } from "@/components/shared/link";
import { cn } from "@/lib/utils";

// Founder-only tool: English labels (Figma page 15). shortcut: not translated, add messages if admins need Bengali.
const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/announcements", label: "Announcements" },
] as const;

export function AdminTabs({ current }: { current: (typeof TABS)[number]["href"] }) {
  return (
    <nav aria-label="Admin" className="mx-auto mb-4 flex w-full max-w-5xl gap-1 rounded-rp-input bg-rp-accent-tint p-0.5">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.href === current ? "page" : undefined}
          className={cn(
            "rp-small flex h-9 flex-1 items-center justify-center rounded-[7px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rp-focus",
            tab.href === current ? "bg-rp-surface text-rp-ink shadow-sm" : "text-rp-muted hover:text-rp-ink",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
