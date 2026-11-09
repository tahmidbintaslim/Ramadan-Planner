// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { hasPushSubscription, pushSupported, subscribeToPush } from "./push-subscribe";

afterEach(() => vi.unstubAllGlobals());

describe("push-subscribe", () => {
  it("reports unsupported (and no subscription) where the browser has no push", async () => {
    expect(pushSupported()).toBe(false);
    expect(await hasPushSubscription()).toBe(false);
    expect(await subscribeToPush()).toBe("unsupported");
  });

  it("stops at a denied permission without subscribing or calling the server", async () => {
    const register = vi.fn();
    const fetchSpy = vi.fn();
    vi.stubGlobal("PushManager", function PushManager() {});
    vi.stubGlobal("Notification", { permission: "default", requestPermission: async () => "denied" });
    Object.defineProperty(navigator, "serviceWorker", { value: { register }, configurable: true });
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "BAAA");
    expect(await subscribeToPush()).toBe("denied");
    expect(register).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    Reflect.deleteProperty(navigator, "serviceWorker");
    vi.unstubAllEnvs();
  });
});
