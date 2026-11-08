import { describe, expect, it } from "vitest";
import vercelConfig from "../../vercel.json" with { type: "json" };
import { securityHeaders } from "./security-headers";

const headers = securityHeaders();
const csp = headers["Content-Security-Policy-Report-Only"];
const directive = (name: string) =>
  csp
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `))
    ?.split(/\s+/)
    .slice(1) ?? [];

describe("security headers (vercel.json, copied into the Node build)", () => {
  it("sets the baseline headers", () => {
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toBe("geolocation=(self), camera=(), microphone=()");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Strict-Transport-Security"]).toContain("includeSubDomains");
    expect(headers["Cross-Origin-Opener-Policy"]).toBe("same-origin-allow-popups");
  });

  it("ships the CSP as Report-Only (it cannot break production yet)", () => {
    expect(headers).not.toHaveProperty("Content-Security-Policy");
    expect(csp).toBeTruthy();
    expect(csp).not.toContain("upgrade-insecure-requests"); // ignored (with a warning) in Report-Only
  });

  it("allows what the app loads: Clerk, Vercel insights, Quran audio, Stripe Checkout, self-hosted fonts", () => {
    expect(directive("default-src")).toEqual(["'self'"]);
    for (const host of ["https://*.clerk.accounts.dev", "https://clerk.ramadanplanner.tahmid.space"]) {
      expect(directive("script-src")).toContain(host);
      expect(directive("connect-src")).toContain(host);
    }
    expect(directive("img-src")).toContain("https://img.clerk.com");
    expect(directive("script-src")).toEqual(expect.arrayContaining(["'self'", "https://va.vercel-scripts.com", "https://js.stripe.com"]));
    expect(directive("frame-src")).toEqual(expect.arrayContaining(["https://checkout.stripe.com", "https://js.stripe.com"]));
    expect(directive("media-src")).toEqual(
      expect.arrayContaining(["https://*.mp3quran.net", "https://everyayah.com", "https://the-quran-project.github.io", "https://raw.githubusercontent.com"]),
    );
    expect(directive("font-src")).toEqual(["'self'", "data:"]);
    expect(directive("frame-ancestors")).toEqual(["'none'"]);
    expect(directive("object-src")).toEqual(["'none'"]);
  });

  it("never allows inline or eval scripts wholesale (static inline scripts are pinned by hash)", () => {
    const scriptSrc = directive("script-src");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    expect(scriptSrc.filter((s) => s.startsWith("'sha256-")).length).toBeGreaterThanOrEqual(3);
  });

  it("redirects only the production *.vercel.app alias to the canonical host (308), never preview hosts", () => {
    const [rule, ...rest] = vercelConfig.redirects;
    expect(rest).toEqual([]);
    expect(rule.permanent).toBe(true);
    expect(rule.has).toEqual([{ type: "host", value: "ramadan-planner-puce\\.vercel\\.app" }]);
    expect(rule.destination).toBe("https://ramadanplanner.tahmid.space/$1");
    // The cron entry point is not redirected (Vercel Cron does not follow redirects).
    const source = new RegExp(`^${rule.source}$`);
    expect(source.test("/today")).toBe(true);
    expect(source.test("/api/push/dispatch")).toBe(false);
  });
});
