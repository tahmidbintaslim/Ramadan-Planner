// @vitest-environment jsdom
import { createElement } from "react"
import { fireEvent, render, screen, cleanup } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { useState } from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Badge, badgeVariants } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { SectionHeader } from "@/components/design/section-header"

afterEach(cleanup)

describe("buttonVariants", () => {
  it("default and primary are the v4 primary fill: Regular 44 at radius 10, Large 56 at radius 12", () => {
    for (const variant of ["default", "primary"] as const) {
      const c = buttonVariants({ variant })
      expect(c).toContain("bg-rp-primary")
      expect(c).toContain("text-rp-on-primary")
      expect(c).toContain("rounded-rp-sm")
      expect(c).toContain("h-11")
    }
    expect(buttonVariants({ size: "lg" })).toContain("rounded-rp-input")
  })
  it("soft and its legacy alias secondary share the tint look", () => {
    for (const variant of ["soft", "secondary"] as const) {
      const c = buttonVariants({ variant })
      expect(c).toContain("bg-rp-accent-tint")
      expect(c).toContain("text-rp-accent")
    }
  })
  it("outline uses surface + strong border", () => {
    const c = buttonVariants({ variant: "outline" })
    expect(c).toContain("bg-rp-surface")
    expect(c).toContain("border-rp-strong")
    expect(c).toContain("text-rp-ink")
  })
  it("quiet, ghost and link are transparent accent text", () => {
    for (const variant of ["quiet", "ghost", "link"] as const) {
      const c = buttonVariants({ variant })
      expect(c).toContain("bg-transparent")
      expect(c).toContain("text-rp-accent")
    }
  })
  it("keeps destructive, sizes and focus/disabled styles", () => {
    expect(buttonVariants({ variant: "destructive" })).toContain("bg-destructive")
    expect(buttonVariants({ size: "sm" })).toContain("h-11")
    expect(buttonVariants({ size: "icon" })).toContain("size-11")
    expect(buttonVariants({ size: "lg" })).toContain("h-14")
    expect(buttonVariants()).toContain("focus-visible:ring-")
    // 44px pixel floors under the 80% font setting (rem-based 44px would be 35.2px).
    expect(buttonVariants()).toContain("min-h-[44px]")
    expect(buttonVariants({ size: "icon" })).toContain("min-w-[44px]")
    expect(buttonVariants()).toContain("disabled:opacity-50")
  })
  it("renders a button with variant data attribute", () => {
    render(createElement(Button, { variant: "soft" }, "Go"))
    expect(screen.getByRole("button", { name: "Go" }).getAttribute("data-variant")).toBe("soft")
  })
})

describe("badgeVariants", () => {
  it("covers default, soft, gold and outline", () => {
    expect(badgeVariants({ variant: "default" })).toContain("bg-rp-live")
    expect(badgeVariants({ variant: "soft" })).toContain("bg-rp-accent-tint")
    expect(badgeVariants({ variant: "gold" })).toContain("bg-rp-gold-tint")
    expect(badgeVariants({ variant: "gold" })).toContain("text-rp-gold-text")
    expect(badgeVariants({ variant: "outline" })).toContain("border-rp-strong")
    // v4 chip: 24 tall, radius 11, Footnote 13 (no Bengali below 13px).
    expect(badgeVariants()).toContain("rounded-[11px]")
    expect(badgeVariants()).toContain("rp-caption")
  })
  it("renders", () => {
    render(createElement(Badge, null, "New"))
    expect(screen.getByText("New")).toBeTruthy()
  })
})

describe("Card", () => {
  it("is a soft 24px surface without border", () => {
    render(createElement(Card, { id: "c" }))
    const cls = (document.getElementById("c") as HTMLElement).className
    expect(cls).toContain("rounded-rp-lg")
    expect(cls).toContain("bg-rp-surface")
    expect(cls).toContain("shadow-rp-soft")
    expect(cls).not.toMatch(/(^|\s)border(\s|$)/)
  })
})

describe("Chip", () => {
  it("is a 48px pill sized by min-height and padding, not a fixed height or line-height", () => {
    render(createElement(Chip, null, "Fajr"))
    const cls = screen.getByRole("button", { name: "Fajr" }).className
    expect(cls).toContain("py-2")
    expect(cls).not.toMatch(/(^|\s)h-\d/)
    expect(cls).not.toMatch(/leading-/)
  })
  it("keeps a 48px pixel floor when the font control scales rem down", () => {
    render(createElement(Chip, null, "Asr"))
    expect(screen.getByRole("button", { name: "Asr" }).className).toContain("min-h-[48px]")
  })
  it("is a type=button with aria-pressed reflecting selected", () => {
    function Harness() {
      const [on, setOn] = useState(false)
      return createElement(Chip, { selected: on, onClick: () => setOn(!on) }, "Fajr")
    }
    render(createElement(Harness))
    const chip = screen.getByRole("button", { name: "Fajr" })
    expect(chip.getAttribute("type")).toBe("button")
    expect(chip.getAttribute("aria-pressed")).toBe("false")
    expect(chip.className).toContain("bg-rp-surface")
    fireEvent.click(chip)
    expect(chip.getAttribute("aria-pressed")).toBe("true")
    expect(chip.className).toContain("bg-rp-live")
    expect(chip.className).toContain("text-rp-on-live")
  })
})

describe("SectionHeader", () => {
  it("renders the title as a heading with an optional action", () => {
    render(createElement(SectionHeader, { title: "Prayers", action: createElement("a", { href: "/x" }, "See all") }))
    expect(screen.getByRole("heading", { name: "Prayers", level: 2 }).className).toContain("rp-headline")
    expect(screen.getByRole("link", { name: "See all" })).toBeTruthy()
  })
  it("omits the action slot when none is given", () => {
    const { container } = render(createElement(SectionHeader, { title: "Only" }))
    expect(container.querySelector("[data-slot=section-header-action]")).toBeNull()
  })
})
