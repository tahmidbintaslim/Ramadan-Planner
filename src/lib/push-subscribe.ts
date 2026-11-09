// Web push for signed-in users: permission, service worker subscription and the server record. Shared by Settings
// and the Reminders "notifications off" banner.

export type PushResult = "ok" | "unsupported" | "missing-key" | "denied" | "error";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** True when this browser already has notification permission and a push subscription. */
export async function hasPushSubscription(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    return Boolean(await registration?.pushManager.getSubscription());
  } catch {
    return false;
  }
}

/** Ask for permission, subscribe this browser and store the subscription for the signed-in user. */
export async function subscribeToPush(): Promise<PushResult> {
  try {
    if (!pushSupported()) return "unsupported";
    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) return "missing-key";
    if ((await Notification.requestPermission()) !== "granted") return "denied";

    const registration = await navigator.serviceWorker.register("/sw.js");
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      }));

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });
    return res.ok ? "ok" : "error";
  } catch {
    return "error";
  }
}
