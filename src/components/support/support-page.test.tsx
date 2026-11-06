// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SUPPORT_CONFIG, type SupportConfig } from "@/config/support";
import { WithIntl } from "@/components/prayer/test-utils";
import { SupportPage } from "./support-page";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setup(config: Partial<SupportConfig> = {}, locale: "bn" | "en" = "bn") {
  return render(
    <WithIntl locale={locale}>
      <SupportPage config={{ ...SUPPORT_CONFIG, ...config }} />
    </WithIntl>,
  );
}

describe("SupportPage, nothing configured", () => {
  it("disables the wallet and card buttons with the coming-soon label", () => {
    setup();
    const wallet = screen.getByTestId("wallet-button");
    expect(wallet).toBeDisabled();
    expect(wallet).toHaveTextContent("শীঘ্রই চালু হবে");
    const card = screen.getByTestId("card-button");
    expect(card).toBeDisabled();
    expect(card).toHaveTextContent("প্রবাস থেকে কার্ডে দিন");
    expect(card).toHaveTextContent("শীঘ্রই");
  });

  it("shows placeholders in the ledger and hides the receipts link", () => {
    setup();
    for (const k of ["server", "push", "translation"]) {
      expect(screen.getByTestId(`cost-${k}`)).toHaveTextContent("শীঘ্রই প্রকাশ করা হবে");
    }
    expect(screen.queryByTestId("ledger-link")).toBeNull();
  });

  it("states honestly that giving is voluntary and not tax-deductible yet", () => {
    setup();
    const note = screen.getByTestId("support-note");
    expect(note).toHaveTextContent("স্বেচ্ছায়");
    expect(note).toHaveTextContent("কর-রেয়াতযোগ্য নয়");
  });

  it("shows the intro, the repo and translation links, share, and hides the mosque row without an email", () => {
    setup();
    expect(screen.getByRole("heading", { name: "এই আমল চলমান থাকুক" })).toBeInTheDocument();
    expect(screen.getByText(/কোনো ফিচার লক নেই/)).toBeInTheDocument();
    const repo = screen.getByTestId("repo-link");
    expect(repo).toHaveAttribute("href", "https://github.com/tahmidbintaslim/Ramadan-Planner");
    expect(repo).toHaveAttribute("rel", "noopener noreferrer");
    expect(repo).toHaveAttribute("target", "_blank");
    expect(screen.getByTestId("translate-link")).toHaveAttribute(
      "href",
      "https://github.com/tahmidbintaslim/Ramadan-Planner/issues",
    );
    expect(screen.getByTestId("share-button")).toBeInTheDocument();
    expect(screen.queryByTestId("mosque-link")).toBeNull();
  });
});

describe("SupportPage, configured", () => {
  const configured = { bkashNumber: "01711111111", nagadNumber: "01822222222" };

  it("enables the wallet button with the chosen amount in Bengali digits", () => {
    setup(configured);
    const wallet = screen.getByTestId("wallet-button");
    expect(wallet).toBeEnabled();
    expect(wallet).toHaveTextContent("বিকাশ / নগদে ৳১০০ দিন");
    fireEvent.click(screen.getByRole("button", { name: "৳৫০০" }));
    expect(wallet).toHaveTextContent("বিকাশ / নগদে ৳৫০০ দিন");
    expect(screen.getByRole("button", { name: "৳৫০০" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "৳১০০" })).toHaveAttribute("aria-pressed", "false");
  });

  it("opens the sheet with both numbers, the reference, steps and copy buttons", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    setup(configured);
    fireEvent.click(screen.getByTestId("wallet-button"));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByTestId("number-bkash")).toHaveTextContent("০১৭১১১১১১১১");
    expect(within(dialog).getByTestId("number-nagad")).toHaveTextContent("০১৮২২২২২২২২");
    expect(within(dialog).getByTestId("sheet-amount")).toHaveTextContent("৳১০০");
    expect(within(dialog).getByTestId("payment-reference")).toHaveTextContent("Ramadan Planner");
    expect(within(dialog).getAllByRole("listitem").length).toBeGreaterThanOrEqual(5);
    expect(within(dialog).getByText(/Send Money/, { selector: "li" })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "বিকাশ (পার্সোনাল) নম্বর কপি করুন" }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("01711111111"));
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("কপি হয়েছে"));

    fireEvent.click(within(dialog).getByRole("button", { name: "রেফারেন্স কপি করুন" }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("Ramadan Planner"));
  });

  it("shows only the configured wallet and the monthly note, and reports a failed copy", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });
    setup({ bkashNumber: null, nagadNumber: "01822222222" });
    fireEvent.click(screen.getByRole("button", { name: "প্রতি মাসে" }));
    fireEvent.click(screen.getByTestId("wallet-button"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByTestId("number-bkash")).toBeNull();
    expect(within(dialog).getByTestId("number-nagad")).toBeInTheDocument();
    expect(within(dialog).getByText(/নিজে থেকে কিছু কাটি না/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /নগদ.*কপি করুন/ }));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it("treats a malformed number as not configured", () => {
    setup({ bkashNumber: "12345", nagadNumber: null });
    expect(screen.getByTestId("wallet-button")).toBeDisabled();
  });

  it("links the card donation page and the receipts page from config", () => {
    setup({ cardUrl: "https://opencollective.com/ramadan-planner", ledgerUrl: "https://example.org/ledger" });
    const card = screen.getByTestId("card-button");
    expect(card).toHaveAttribute("href", "https://opencollective.com/ramadan-planner");
    expect(card).toHaveAttribute("rel", "noopener noreferrer");
    const ledger = screen.getByTestId("ledger-link");
    expect(ledger).toHaveAttribute("href", "https://example.org/ledger");
    expect(ledger).toHaveTextContent("প্রতিটি লেনদেনের রসিদ");
  });

  it("ignores non-http card or ledger URLs", () => {
    setup({ cardUrl: "javascript:alert(1)", ledgerUrl: "ftp://x" });
    expect(screen.getByTestId("card-button")).toBeDisabled();
    expect(screen.queryByTestId("ledger-link")).toBeNull();
  });

  it("shows configured costs and the mosque mailto", () => {
    setup({ costs: { server: "৳১২,০০০", push: "৳৩,০০০", translation: null }, contactEmail: "hello@example.org" });
    expect(screen.getByTestId("cost-server")).toHaveTextContent("৳১২,০০০");
    expect(screen.getByTestId("cost-translation")).toHaveTextContent("শীঘ্রই প্রকাশ করা হবে");
    expect(screen.getByTestId("mosque-link").getAttribute("href")).toMatch(/^mailto:hello@example\.org\?subject=/);
  });

  it("only claims tax relief when the flag is set", () => {
    setup({ taxDeductible: true });
    expect(screen.getByTestId("support-note")).toHaveTextContent("কর-রেয়াতের জন্য ব্যবহার করা যাবে");
    expect(screen.getByTestId("support-note")).not.toHaveTextContent("কর-রেয়াতযোগ্য নয়");
  });
});

describe("custom amount", () => {
  const configured = { bkashNumber: "01711111111" };

  it("reveals a number field on অন্য and validates it", () => {
    setup(configured);
    expect(screen.queryByLabelText("অন্য পরিমাণ (৳)")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "অন্য" }));
    const input = screen.getByLabelText("অন্য পরিমাণ (৳)");
    const wallet = screen.getByTestId("wallet-button");

    // Empty: disabled, hint (not an error) shown.
    expect(wallet).toBeDisabled();
    expect(input).toHaveAttribute("aria-invalid", "false");

    fireEvent.change(input, { target: { value: "5" } });
    expect(wallet).toBeDisabled();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("সর্বনিম্ন ৳১০");

    fireEvent.change(input, { target: { value: "abc" } });
    expect(screen.getByRole("alert")).toHaveTextContent("শুধু সংখ্যা লিখুন");

    fireEvent.change(input, { target: { value: "9999999" } });
    expect(screen.getByRole("alert")).toHaveTextContent("সর্বোচ্চ");
    expect(wallet).toBeDisabled();

    fireEvent.change(input, { target: { value: "২৫০" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(wallet).toBeEnabled();
    expect(wallet).toHaveTextContent("বিকাশ / নগদে ৳২৫০ দিন");
  });

  it("works in English with ASCII digits", () => {
    setup(configured, "en");
    expect(screen.getByTestId("wallet-button")).toHaveTextContent("Give ৳100 via bKash / Nagad");
    expect(screen.getByRole("heading", { level: 1, name: "Support & Contribute" })).toBeInTheDocument();
  });
});

describe("share", () => {
  it("uses Web Share when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    setup();
    fireEvent.click(screen.getByTestId("share-button"));
    await vi.waitFor(() => expect(share).toHaveBeenCalled());
    expect(share.mock.calls[0][0].url).toBe(`${window.location.origin}/`);
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  });

  it("falls back to copying the link, and reports a failure", async () => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    setup();
    fireEvent.click(screen.getByTestId("share-button"));
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("লিংক কপি হয়েছে"));

    writeText.mockRejectedValueOnce(new Error("nope"));
    fireEvent.click(screen.getByTestId("share-button"));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith("শেয়ার করা যায়নি"));
  });
});
