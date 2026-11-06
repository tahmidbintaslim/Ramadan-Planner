import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rp-caption h-6 rounded-[11px] border border-transparent px-2 w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-rp-live text-rp-on-live [a&]:hover:bg-rp-live/90",
        soft: "bg-rp-accent-tint text-rp-accent [a&]:hover:bg-rp-accent-tint/70",
        // legacy name, same look as soft
        secondary:
          "bg-rp-accent-tint text-rp-accent [a&]:hover:bg-rp-accent-tint/70",
        gold: "bg-rp-gold-tint text-rp-gold-text",
        destructive:
          "bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border-rp-strong text-rp-ink [a&]:hover:bg-rp-accent-tint",
        ghost: "text-rp-accent [a&]:hover:bg-rp-accent-tint",
        link: "text-rp-accent underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
