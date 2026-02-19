"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Bell, CalendarClock, Globe, LogIn, LogOut, UserPlus } from "lucide-react";
import { switchLocaleAction } from "@/actions/locale";
import { logoutAction } from "@/actions/auth";
import { getUserProfileAction, updateUserProfileAction } from "@/actions/planner";
import {
  disconnectGoogleCalendarAction,
  getGoogleCalendarStatusAction,
  getOrCreateIcsLinkAction,
  getPushStatusAction,
  revokeIcsLinkAction,
  syncGoogleCalendarAction,
} from "@/actions/integrations";
import { useAuth } from "@/components/providers/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { formatLocalizedNumber } from "@/lib/locale-number";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export function SettingsContent() {
  const t = useTranslations("settings");
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const searchParams = useSearchParams();

  const [isPending, startTransition] = useTransition();
  const { user, isGuest, loading } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("Asia/Dhaka");
  const [locationLabel, setLocationLabel] = useState("ঢাকা, বাংলাদেশ");
  const [latitude, setLatitude] = useState("23.8103");
  const [longitude, setLongitude] = useState("90.4125");

  const [icsLink, setIcsLink] = useState<string>("");
  const [pushCount, setPushCount] = useState<number>(0);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleSyncedAt, setGoogleSyncedAt] = useState<string | null>(null);

  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || isGuest) return;

    startTransition(async () => {
      const [profileRes, pushRes, googleRes] = await Promise.all([
        getUserProfileAction(),
        getPushStatusAction(),
        getGoogleCalendarStatusAction(),
      ]);

      if (!profileRes.ok) {
        setError(t("genericError"));
        return;
      }

      setDisplayName(profileRes.data.displayName);
      setTimezone(profileRes.data.timezone);
      setLocationLabel(profileRes.data.locationLabel);
      setLatitude(String(profileRes.data.latitude));
      setLongitude(String(profileRes.data.longitude));

      if (pushRes.ok) {
        setPushCount(pushRes.data.subscriptions);
      }

      if (googleRes.ok) {
        setGoogleConnected(googleRes.data.connected);
        setGoogleSyncedAt(googleRes.data.syncedAt);
      }
    });
  }, [isGuest, loading, t]);

  const googleStatusParam = searchParams.get("google");
  const googleInlineStatus =
    googleStatusParam === "connected" ? t("googleConnected") : null;
  const googleInlineError =
    googleStatusParam && googleStatusParam !== "connected"
      ? t("googleConnectError")
      : null;

  const handleLocaleSwitch = () => {
    startTransition(() => {
      switchLocaleAction();
    });
  };

  const handleLogout = () => {
    startTransition(() => {
      logoutAction();
    });
  };

  const saveProfile = () => {
    if (isGuest) return;

    const lat = Number.parseFloat(latitude);
    const lng = Number.parseFloat(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError(t("invalidCoordinates"));
      return;
    }

    setError(null);
    setStatus(null);

    startTransition(async () => {
      const res = await updateUserProfileAction({
        displayName: displayName.trim(),
        timezone: timezone.trim(),
        locationLabel: locationLabel.trim(),
        latitude: lat,
        longitude: lng,
      });

      if (!res.ok) {
        setError(t("genericError"));
        return;
      }

      setStatus(t("saved"));
    });
  };

  const generateIcsLink = () => {
    if (isGuest) return;

    setError(null);
    startTransition(async () => {
      const res = await getOrCreateIcsLinkAction();
      if (!res.ok) {
        setError(t("genericError"));
        return;
      }

      setIcsLink(`${window.location.origin}${res.data.urlPath}`);
      setStatus(t("icsReady"));
    });
  };

  const revokeIcsLink = () => {
    if (isGuest) return;

    setError(null);
    startTransition(async () => {
      const res = await revokeIcsLinkAction();
      if (!res.ok) {
        setError(t("genericError"));
        return;
      }

      setIcsLink("");
      setStatus(t("icsRevoked"));
    });
  };

  const syncGoogleCalendar = () => {
    if (isGuest) return;

    setError(null);
    startTransition(async () => {
      const res = await syncGoogleCalendarAction();
      if (!res.ok) {
        setError(
          res.error === "google_not_connected"
            ? t("googleConnectRequired")
            : t("genericError"),
        );
        return;
      }

      setGoogleSyncedAt(new Date().toISOString());
      setGoogleConnected(true);
      setStatus(
        t("googleSynced", {
          count: formatLocalizedNumber(res.data.syncedEvents, locale),
        }),
      );
    });
  };

  const disconnectGoogleCalendar = () => {
    if (isGuest) return;

    setError(null);
    startTransition(async () => {
      const res = await disconnectGoogleCalendarAction();
      if (!res.ok) {
        setError(t("genericError"));
        return;
      }

      setGoogleConnected(false);
      setGoogleSyncedAt(null);
      setStatus(t("googleDisconnected"));
    });
  };

  const enablePush = async () => {
    if (isGuest) return;

    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setError(t("pushUnsupported"));
        return;
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        setError(t("pushMissingKey"));
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError(t("pushPermissionDenied"));
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
        });
      }

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!res.ok) {
        setError(t("genericError"));
        return;
      }

      const statusRes = await getPushStatusAction();
      if (statusRes.ok) {
        setPushCount(statusRes.data.subscriptions);
      }

      setStatus(t("pushEnabled"));
    } catch {
      setError(t("genericError"));
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      {googleInlineError && !error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          {googleInlineError}
        </p>
      )}
      {status && (
        <p className="text-sm text-emerald-700 bg-emerald-100 rounded-md px-3 py-2">
          {status}
        </p>
      )}
      {googleInlineStatus && !status && (
        <p className="text-sm text-emerald-700 bg-emerald-100 rounded-md px-3 py-2">
          {googleInlineStatus}
        </p>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4 text-primary" />
            {t("language")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t("language")}</Label>
            <Button variant="outline" size="sm" onClick={handleLocaleSwitch} disabled={isPending}>
              বাংলা / English
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("profileSettings")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isGuest ? (
            <p className="text-sm text-muted-foreground">{t("loginToManage")}</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="display-name">{t("displayName")}</Label>
                <Input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t("displayName")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">{t("timezone")}</Label>
                <Input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder={t("timezonePlaceholder")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">{t("location")}</Label>
                <Input id="location" value={locationLabel} onChange={(e) => setLocationLabel(e.target.value)} placeholder={t("location")} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="latitude">{t("latitude")}</Label>
                  <Input id="latitude" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder={t("latitudePlaceholder")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="longitude">{t("longitude")}</Label>
                  <Input id="longitude" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder={t("longitudePlaceholder")} />
                </div>
              </div>

              <Button onClick={saveProfile} disabled={isPending}>{tCommon("save")}</Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4 text-primary" />
            {t("calendarSync")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("calendarSyncDesc")}</p>
          <div className="rounded-md border p-3 space-y-2">
            <p className="text-sm font-medium">{t("googleCalendar")}</p>
            <p className="text-xs text-muted-foreground">
              {googleConnected
                ? t("googleConnectedHint")
                : t("googleDisconnectedHint")}
            </p>
            {googleSyncedAt && (
              <p className="text-xs text-muted-foreground">
                {t("googleLastSynced", {
                  at: new Date(googleSyncedAt).toLocaleString(
                    locale.startsWith("bn") ? "bn-BD-u-nu-beng" : "en-US",
                  ),
                })}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {!googleConnected ? (
                <Button variant="outline" asChild disabled={isGuest}>
                  <Link href="/api/calendar/google/connect">{t("connectGoogle")}</Link>
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={syncGoogleCalendar} disabled={isPending || isGuest}>
                    {t("syncGoogle")}
                  </Button>
                  <Button variant="destructive" onClick={disconnectGoogleCalendar} disabled={isPending || isGuest}>
                    {t("disconnectGoogle")}
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={generateIcsLink} disabled={isPending || isGuest}>
              {t("generateIcs")}
            </Button>
            <Button variant="destructive" onClick={revokeIcsLink} disabled={isPending || isGuest || !icsLink}>
              {t("revokeIcs")}
            </Button>
          </div>
          {icsLink && <Input value={icsLink} readOnly />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-primary" />
            {t("notifications")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("pushSubscriptions", {
              count: formatLocalizedNumber(pushCount, locale),
            })}
          </p>
          <Button variant="outline" onClick={enablePush} disabled={isGuest}>
            {t("enablePush")}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {!loading && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            {isGuest ? (
              <>
                <p className="text-sm text-muted-foreground mb-4">{t("profile")}</p>
                <Button className="w-full" asChild>
                  <Link href="/signup">
                    <UserPlus className="h-4 w-4 mr-2" />
                    {tAuth("signup")}
                  </Link>
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/login">
                    <LogIn className="h-4 w-4 mr-2" />
                    {tAuth("login")}
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <Button variant="destructive" className="w-full" onClick={handleLogout} disabled={isPending}>
                  <LogOut className="h-4 w-4 mr-2" />
                  {tAuth("logout")}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
