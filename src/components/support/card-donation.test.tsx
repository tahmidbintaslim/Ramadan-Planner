// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SUPPORT_CONFIG, type SupportConfig } from "@/config/support";
import { WithIntl } from "@/components/prayer/test-utils";
import { MONTHLY_SESSION_KEY, rememberMonthlySession } from "./card-donation";
import { SupportPage, type DonationResult } from "./support-page";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const assign = vi.fn();
const realLocation = window.location;
const SUMMARY = {
  months: [
    { month: "2026-11", currency: "usd", grossMinor: 3500, refundedMinor: 500, payments: 2 },
    { month: "2026-11", currency: "gbp", grossMinor: 1000, refundedMinor: 0, payments: 1 },
  ],
  donorCount: 3,
  generatedAt: "2026-11-06T00:00:00.000Z",
};

type FetchCall = [string, RequestInit | undefined];
let fetchMock: ReturnType<typeof vi.fn>;

function mockFetch(checkout: { status?: number; body: unknown } = { body: { ok: true, url: "https://checkout.stripe.com/c/pay/cs_test_x" } }, summary: { status?: number; body: unknown } = { body: SUMMARY }) {
  fetchMock = vi.fn(async (url: string) => {
    const r = url.includes("summary") ? summary : checkout;
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
}

beforeEach(() => {
  Object.defineProperty(window, "location", { value: { ...realLocation, assign }, configurable: true, writable: true });
  localStorage.clear();
  mockFetch();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  Object.defineProperty(window, "location", { value: realLocation, configurable: true, writable: true });
});

function setup(opts: { config?: Partial<SupportConfig>; locale?: "bn" | "en"; result?: DonationResult; monthly?: boolean } = {}) {
  return render(
    <WithIntl locale={opts.locale ?? "bn"}>
      <SupportPage config={{ ...SUPPORT_CONFIG, stripeEnabled: true, ...opts.config }} donationResult={opts.result} donationMonthly={opts.monthly} />
    </WithIntl>,
  );
}

const checkoutBody = () => {
  const call = (fetchMock.mock.calls as FetchCall[]).find(([u]) => u === "/api/donations/checkout");
  return call ? JSON.parse(String(call[1]?.body)) : null;
};

describe("card donations off (the shipped default)", () => {
  it("shows no card form or transparency card, and keeps the coming-soon card button", () => {
    setup({ config: { stripeEnabled: false } });
    expect(screen.queryByTestId("card-donation")).toBeNull();
    expect(screen.queryByTestId("transparency-card")).toBeNull();
    expect(screen.getByTestId("card-button")).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("card donations on", () => {
  it("replaces the disabled card button with the Stripe form and keeps the bKash/Nagad flow", () => {
    setup({ config: { bkashNumber: "01711111111" } });
    expect(screen.queryByTestId("card-button")).toBeNull();
    expect(screen.getByTestId("wallet-button")).toBeEnabled();
    const form = screen.getByTestId("card-donation");
    expect(within(form).getByRole("heading", { name: "কার্ডে সাদাকা দিন" })).toBeInTheDocument();
    expect(within(form).getByTestId("stripe-button")).toHaveTextContent(/^কার্ডে .*১০.* দিন$/);
  });

  it("posts the choice and follows the returned Stripe URL", async () => {
    setup({ locale: "en" });
    const form = screen.getByTestId("card-donation");
    fireEvent.click(within(form).getByRole("button", { name: "$25" }));
    fireEvent.click(within(form).getByRole("button", { name: "Monthly" }));
    const button = within(form).getByTestId("stripe-button");
    expect(button).toHaveTextContent("Give $25 every month");
    fireEvent.click(button);
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/cs_test_x"));
    expect(checkoutBody()).toEqual({ amount: 25, currency: "usd", frequency: "monthly", locale: "en" });
    expect(button).toHaveTextContent("Opening Stripe…");
  });

  it("sends a custom amount in the chosen currency", async () => {
    setup({ locale: "en" });
    const form = screen.getByTestId("card-donation");
    fireEvent.change(within(form).getByLabelText("Currency"), { target: { value: "gbp" } });
    fireEvent.click(within(form).getByRole("button", { name: "Other" }));
    const input = within(form).getByLabelText("Other amount (GBP)");
    fireEvent.change(input, { target: { value: "0.5" } });
    expect(within(form).getByRole("alert")).toHaveTextContent("Minimum £1");
    expect(within(form).getByTestId("stripe-button")).toBeDisabled();
    fireEvent.change(input, { target: { value: "12.50" } });
    expect(within(form).queryByRole("alert")).toBeNull();
    fireEvent.click(within(form).getByTestId("stripe-button"));
    await vi.waitFor(() => expect(assign).toHaveBeenCalled());
    expect(checkoutBody()).toEqual({ amount: 12.5, currency: "gbp", frequency: "once", locale: "en" });
  });

  it("offers taka one-time only: monthly is disabled and reset when switching to BDT", () => {
    setup();
    const form = screen.getByTestId("card-donation");
    fireEvent.click(within(form).getByRole("button", { name: "প্রতি মাসে" }));
    fireEvent.change(within(form).getByLabelText("মুদ্রা"), { target: { value: "bdt" } });
    const monthly = within(form).getByRole("button", { name: "প্রতি মাসে" });
    expect(monthly).toBeDisabled();
    expect(within(form).getByRole("button", { name: "একবার" })).toHaveAttribute("aria-pressed", "true");
    expect(within(form).getByText(/টাকায় মাসিক দান এখনো চালু নেই/)).toBeInTheDocument();
    expect(within(form).getByTestId("stripe-button")).toHaveTextContent("৳");
  });

  it("shows an honest error and stays on the page when checkout fails", async () => {
    mockFetch({ status: 503, body: { ok: false, error: "unavailable" } });
    setup({ locale: "en" });
    fireEvent.click(screen.getByTestId("stripe-button"));
    expect(await screen.findByTestId("card-error")).toHaveTextContent("Card giving can't start right now");
    expect(assign).not.toHaveBeenCalled();
    expect(screen.getByTestId("stripe-button")).toBeEnabled();
  });

  it("never follows a non-https URL from the server", async () => {
    mockFetch({ body: { ok: true, url: "javascript:alert(1)" } });
    setup({ locale: "en" });
    fireEvent.click(screen.getByTestId("stripe-button"));
    await screen.findByTestId("card-error");
    expect(assign).not.toHaveBeenCalled();
  });

  it("shows the anonymous transparency totals, net of refunds", async () => {
    setup({ locale: "en" });
    const card = screen.getByTestId("transparency-card");
    expect(within(card).getByText("Transparency")).toBeInTheDocument();
    expect(await within(card).findByTestId("transparency-donors")).toHaveTextContent("3");
    const month = within(card).getByTestId("transparency-month");
    expect(month).toHaveTextContent("November 2026");
    expect(month).toHaveTextContent("$30");
    expect(month).toHaveTextContent("$5 refunded");
    expect(month).toHaveTextContent("£10");
  });

  it("says so plainly when there are no donations yet or the totals fail to load", async () => {
    mockFetch(undefined, { body: { months: [], donorCount: 0, generatedAt: "x" } });
    setup();
    expect(await screen.findByTestId("transparency-empty")).toHaveTextContent("এখনো কোনো কার্ড অনুদান আসেনি।");
    cleanup();
    mockFetch(undefined, { status: 500, body: { ok: false } });
    setup();
    expect(await screen.findByTestId("transparency-error")).toBeInTheDocument();
  });

  it("offers the customer portal once a monthly session is remembered on this device", async () => {
    mockFetch({ body: { ok: true, url: "https://billing.stripe.com/p/session/test_y" } });
    setup({ locale: "en" });
    expect(screen.queryByTestId("manage-monthly")).toBeNull();
    act(() => rememberMonthlySession("cs_test_abcDEF123456"));
    expect(localStorage.getItem(MONTHLY_SESSION_KEY)).toBe("cs_test_abcDEF123456");
    fireEvent.click(await screen.findByTestId("manage-monthly"));
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith("https://billing.stripe.com/p/session/test_y"));
    const call = (fetchMock.mock.calls as FetchCall[]).find(([u]) => u === "/api/donations/portal");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ sessionId: "cs_test_abcDEF123456" });
  });

  it("ignores a malformed session id", () => {
    rememberMonthlySession("not-a-session");
    expect(localStorage.getItem(MONTHLY_SESSION_KEY)).toBeNull();
  });
});

describe("return banners", () => {
  it("thanks the donor on success, mentions the monthly controls, and can be dismissed", () => {
    setup({ result: "success", monthly: true });
    const banner = screen.getByTestId("donation-success");
    expect(banner).toHaveAttribute("role", "status");
    expect(banner).toHaveTextContent("জাযাকাল্লাহু খাইরান");
    expect(banner).toHaveTextContent("মাসিক দান বদলাতে");
    fireEvent.click(within(banner).getByRole("button", { name: "বার্তাটি বন্ধ করুন" }));
    expect(screen.queryByTestId("donation-success")).toBeNull();
  });

  it("reassures on cancel that nothing was charged", () => {
    setup({ result: "cancel", locale: "en" });
    expect(screen.getByTestId("donation-cancel")).toHaveTextContent("You were not charged.");
    expect(screen.queryByTestId("donation-success")).toBeNull();
  });

  it("shows no banner without a result", () => {
    setup();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
