import * as React from "react"

import { cn } from "@/lib/utils"

type ChipProps = Omit<React.ComponentProps<"button">, "type"> & {
  selected?: boolean
}

function Chip({ className, selected = false, ...props }: ChipProps) {
  return (
    <button
      type="button"
      data-slot="chip"
      data-selected={selected}
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-[48px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-rp-full px-4 py-2 text-[14px] font-semibold transition-colors outline-none focus-visible:ring-ring focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        selected
          ? "bg-rp-live text-rp-on-live"
          : "border border-rp-rule bg-rp-surface text-rp-ink hover:bg-rp-accent-tint",
        className
      )}
      {...props}
    />
  )
}

export { Chip }
