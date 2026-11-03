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
  it("default and primary are the teal pill at 48px", () => {
    for (const variant of ["default", "primary"] as const) {
      const c = buttonVariants({ variant })
      expect(c).toContain("bg-rp-live")
      expect(c).toContain("text-rp-on-live")
      expect(c).toContain("rounded-rp-full")
      expect(c).toContain("h-12")
    }
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
    expect(buttonVariants({ size: "sm" })).toContain("h-10")
    expect(buttonVariants({ size: "icon" })).toContain("size-12")
    expect(buttonVariants({ size: "lg" })).toContain("h-[52px]")
    expect(buttonVariants()).toContain("focus-visible:ring-")
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
    expect(badgeVariants()).toContain("rounded-full")
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
    expect(screen.getByRole("heading", { name: "Prayers", level: 2 }).className).toContain("rp-h2")
    expect(screen.getByRole("link", { name: "See all" })).toBeTruthy()
  })
  it("omits the action slot when none is given", () => {
    const { container } = render(createElement(SectionHeader, { title: "Only" }))
    expect(container.querySelector("[data-slot=section-header-action]")).toBeNull()
  })
})
