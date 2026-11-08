import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const soft = "bg-rp-accent-tint text-rp-accent hover:bg-rp-accent-tint/70"
const quiet =
  "bg-transparent text-rp-accent hover:bg-rp-accent-tint"

const buttonVariants = cva(
  "rp-button rp-pressable inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-rp-sm disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-ring focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-offset-rp-page aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-rp-primary text-rp-on-primary hover:bg-rp-primary-pressed",
        primary: "bg-rp-primary text-rp-on-primary hover:bg-rp-primary-pressed",
        soft,
        // legacy name, same look as soft
        secondary: soft,
        outline:
          "border border-rp-strong bg-rp-surface text-rp-ink hover:bg-rp-accent-tint",
        quiet,
        // legacy name, same look as quiet
        ghost: quiet,
        link: "bg-transparent text-rp-accent underline-offset-4 hover:underline",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
      },
      size: {
        // HIG (v4): Regular 44 (radius 10), Large 56 (radius 12). Pixel floors keep 44 when the font control
        // scales rem down to 80%.
        default: "h-11 min-h-[44px] px-4",
        xs: "h-8 gap-1 px-3 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-11 min-h-[44px] gap-1.5 px-4",
        lg: "h-14 min-h-[56px] rounded-rp-input px-6",
        icon: "size-11 min-h-[44px] min-w-[44px]",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-10",
        "icon-lg": "size-[52px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
