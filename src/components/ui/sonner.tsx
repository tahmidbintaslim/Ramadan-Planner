"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  // Auto mode resolves to Light or Night through forcedTheme (see ThemeProvider).
  const { forcedTheme, resolvedTheme } = useTheme()
  const theme = forcedTheme ?? resolvedTheme ?? "light"

  return (
    <Sonner
      theme={(theme === "dark" ? "dark" : "light") as ToasterProps["theme"]}
      // Below 1024px toasts clear the floating bottom nav (--rp-toast-bottom in globals.css).
      offset={{ bottom: "var(--rp-toast-bottom)" }}
      mobileOffset={{ bottom: "var(--rp-toast-bottom)" }}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
