// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WithIntl } from "@/components/prayer/test-utils";
import { TasbihContent } from "./tasbih-content";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function setTarget(value: string) {
  fireEvent.change(screen.getByLabelText("কাস্টম লক্ষ্য নির্ধারণ করুন"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "লক্ষ্য প্রয়োগ করুন" }));
}

describe("tasbih custom target", () => {
  it("accepts either digit set", () => {
    render(<WithIntl><TasbihContent /></WithIntl>);
    setTarget("৫০");
    expect(screen.getByText("লক্ষ্য: ৫০")).toBeInTheDocument();
    setTarget("70");
    expect(screen.getByText("লক্ষ্য: ৭০")).toBeInTheDocument();
  });

  it("rejects a target below one (0.5 would floor to 0 and auto count would never stop)", () => {
    render(<WithIntl><TasbihContent /></WithIntl>);
    for (const bad of ["০.৫", "0.5", "0", "-3"]) {
      setTarget(bad);
      expect(screen.getByText("লক্ষ্য: ৩৩")).toBeInTheDocument();
    }
  });
});
