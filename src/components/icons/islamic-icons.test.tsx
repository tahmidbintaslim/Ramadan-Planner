// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GirihPattern } from "@/components/design/girih-pattern";
import { MihrabArch } from "@/components/design/mihrab-arch";
import { icons } from "@/components/icons/islamic-icons";

afterEach(cleanup);

const names = Object.keys(icons) as (keyof typeof icons)[];

describe("islamic icons", () => {
  it("exports the 58 expected icons", () => {
    expect(names).toHaveLength(58);
    expect(names).toEqual(
      expect.arrayContaining(["Home", "Mosque", "Crescent", "Lantern", "Quran", "Tasbih", "Dua", "Calendar", "Zakat"]),
    );
    expect(names).toEqual(
      expect.arrayContaining(["Mihrab", "Kaaba", "Adzan", "SalahTime", "Dates", "EidMubarak", "RamadanMonth", "MosqueLocation"]),
    );
    expect(names).toEqual(
      expect.arrayContaining(["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha", "Bell", "Pin", "Heart", "Share", "Code"]),
    );
    expect(names).toEqual(expect.arrayContaining(["Plan", "More", "Check", "ChevronRight", "Settings", "Print"]));
    expect(names).toEqual(expect.arrayContaining(["TextSize"]));
  });

  it("uses one stroke width (1.5) on every shape except the Hugeicons dot accents", () => {
    for (const name of names) {
      const Icon = icons[name];
      const { container, unmount } = render(<Icon />);
      const overrides = Array.from(container.querySelectorAll("[stroke-width]"))
        .filter((el) => el.tagName.toLowerCase() !== "svg")
        .map((el) => el.getAttribute("d") ?? "");
      // Only the zero-length "dot" paths (e.g. "M14 4H14.009") draw heavier, as in the Hugeicons originals.
      for (const d of overrides) expect(d).toMatch(/^M[\d.]+ [\d.]+H[\d.]+$/);
      unmount();
    }
  });

  it("the text-size icon draws a Latin A and a Bengali অ, not a wheelchair", () => {
    const { container } = render(<icons.TextSize title="লেখা ও থিম" />);
    expect(container.querySelectorAll("path").length).toBeGreaterThanOrEqual(6);
    expect(container.querySelector("title")?.textContent).toBe("লেখা ও থিম");
  });

  it.each(names)("%s renders a decorative currentColor svg", (name) => {
    const Icon = icons[name];
    const { container } = render(<Icon />);
    const svg = container.querySelector("svg")!;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("width")).toBe("24");
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.getAttribute("fill")).toBe("none");
    expect(svg.getAttribute("stroke-width")).toBe("1.5");
    expect(svg.getAttribute("stroke-linecap")).toBe("round");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("role")).toBeNull();
    expect(svg.querySelector("path, circle, rect")).not.toBeNull();
  });

  it.each(names)("%s with a title is an accessible image", (name) => {
    const Icon = icons[name];
    const { container, getByRole } = render(<Icon title="label" size={32} className="x" />);
    const svg = container.querySelector("svg")!;
    expect(getByRole("img")).toBe(svg);
    expect(svg.getAttribute("aria-hidden")).toBe("false");
    expect(svg.querySelector("title")?.textContent).toBe("label");
    expect(svg.getAttribute("width")).toBe("32");
    expect(svg.getAttribute("class")).toBe("x");
  });
});

describe("motifs", () => {
  it("girih pattern is decorative, non-interactive, fills its parent", () => {
    const { container } = render(<GirihPattern />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.style.pointerEvents).toBe("none");
    expect(svg.style.opacity).toBe("0.07");
    const pattern = svg.querySelector("pattern")!;
    expect(pattern.getAttribute("width")).toBe("40");
    expect(pattern.getAttribute("height")).toBe("40");
    expect(pattern.querySelectorAll("rect")).toHaveLength(2);
    expect(svg.querySelector("g")?.getAttribute("stroke")).toBe("currentColor");
  });

  it("girih pattern accepts opacity and gives unique pattern ids", () => {
    const { container } = render(
      <>
        <GirihPattern opacity={0.1} />
        <GirihPattern />
      </>,
    );
    const [a, b] = Array.from(container.querySelectorAll("svg"));
    expect(a.style.opacity).toBe("0.1");
    expect(a.querySelector("pattern")!.id).not.toBe(b.querySelector("pattern")!.id);
  });

  it("mihrab arch is decorative with two strokes", () => {
    const { container } = render(<MihrabArch className="arch" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("viewBox")).toBe("0 0 300 300");
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    const paths = svg.querySelectorAll("path");
    expect(paths).toHaveLength(2);
    expect(paths[0].getAttribute("stroke-opacity")).toBe("0.16");
    expect(paths[1].getAttribute("stroke-opacity")).toBe("0.08");
  });
});
