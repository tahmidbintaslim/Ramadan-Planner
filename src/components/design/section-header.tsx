import * as React from "react"

import { cn } from "@/lib/utils"

type SectionHeaderProps = Omit<React.ComponentProps<"div">, "title"> & {
  title: React.ReactNode
  /** Optional trailing action: a Link or button. It gets the accent text style. */
  action?: React.ReactNode
  /** Heading element for the title (default h2). */
  as?: "h1" | "h2" | "h3" | "h4"
}

function SectionHeader({
  title,
  action,
  as: Heading = "h2",
  className,
  ...props
}: SectionHeaderProps) {
  return (
    <div
      data-slot="section-header"
      className={cn("flex items-center justify-between gap-3", className)}
      {...props}
    >
      <Heading className="rp-h2 text-rp-ink">{title}</Heading>
      {action ? (
        <div
          data-slot="section-header-action"
          className="text-[14px] leading-[22px] font-semibold text-rp-accent [&_a]:text-rp-accent [&_button]:text-rp-accent"
        >
          {action}
        </div>
      ) : null}
    </div>
  )
}

export { SectionHeader }
