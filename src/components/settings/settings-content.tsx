"use client";

import { track } from "@/lib/track";
import { clearPersonalDeviceData } from "@/lib/sign-out-cleanup";
import { Link } from "@/components/shared/link";
import { useEffect, useState, useTransition } from "react";
import { useClerk } from "@clerk/tanstack-react-start";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { useSearch } from "@tanstack/react-router";
import { Bell, CalendarClock, ChevronRight, Clock, Globe, Heart, LogIn, LogOut, Type, UserPlus } from "lucide-react";
import { LanguageSegmented } from "@/components/layout/shell-actions";
import { AccessibilityDialog } from "@/components/shared/accessibility-sidebar";
import { LUCIDE_STROKE } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";
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
import { Chip } from "@/components/ui/chip";
import { useClockFormat } from "@/hooks/use-clock-format";
import { formatDateTime } from "@/lib/clock-format";
import { CLOCK_FORMATS } from "@/lib/clock-format";
import { formatLocalizedNumber } from "@/lib/locale-number";
import { subscribeToPush } from "@/lib/push-subscribe";
import { DIVIDER, LocationPrayerCard, ROW } from "./location-prayer-card";

/** 12-hour (default) or 24-hour clock, kept on this device; every time on every screen follows it. */
function ClockFormatRow() {
  const t = useTranslations("settings");
  const [format, setFormat] = useClockFormat();
  return (
    <li className={cn(DIVIDER, "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2")}>
      <Clock size={24} strokeWidth={LUCIDE_STROKE} aria-hidden className="shrink-0 text-rp-icon" />
      <span id="clock-format-title" className="rp-row flex-1 whitespace-nowrap text-rp-ink">
        {t("clockFormat")}
      </span>
      <div role="group" aria-labelledby="clock-format-title" className="flex gap-2" data-testid="clock-format">
        {CLOCK_FORMATS.map((f) => (
          <Chip key={f} selected={format === f} onClick={() => setFormat(f)}>
            {t(f === "12h" ? "clockFormat12" : "clockFormat24")}
          </Chip>
        ))}
      </div>
      {format === "12h" ? <p className="rp-small basis-full ps-10 text-rp-muted">{t("clockFormatHint")}</p> : null}
    </li>
  );
}

export function SettingsContent() {
  const t = useTranslations("settings");
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");
  const tNav = useTranslations("nav");
  const tA11y = useTranslations("accessibility");
  const locale = useLocale();
  const [clockFormat] = useClockFormat();
  // Only the `google` result param is read (set by the Google OAuth callback redirect).
  const search = useSearch({ strict: false }) as { google?: unknown };
  const { signOut } = useClerk();

  const [isPending, startTransition] = useTransition();
  const { user, isGuest, loading } = useAuth();
  // The guest-only sign-in notes wait for auth, so a signed-in user never sees them while Clerk loads.
  const showSignInNote = !loading && isGuest;

  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("Asia/Dhaka");
  const [locationLabel, setLocationLabel] = useState("ঢাকা, বাংলাদেশ");
  const [latitude, setLatitude] = useState("23.8103");
  const [longitude, setLongitude] = useState("90.4125");
  // Save stays off until the real profile has loaded: the fields above are placeholders until then (#8).
  const [profileLoaded, setProfileLoaded] = useState(false);

  const [icsLink, setIcsLink] = useState<string>("");
  // A link exists on the server but its URL cannot be shown again (only the secret's hash is stored).
  const [icsActive, setIcsActive] = useState(false);
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

      setProfileLoaded(true);
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

  const googleStatusParam =
    search.google === undefined || search.google === null ? "" : String(search.google);
  const googleInlineStatus =
    googleStatusParam === "connected" ? t("googleConnected") : null;
  const googleInlineError =
    googleStatusParam && googleStatusParam !== "connected"
      ? t("googleConnectError")
      : null;

  const handleLogout = () => {
    startTransition(async () => {
      await clearPersonalDeviceData();
      await signOut({ redirectUrl: "/" });
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

      setIcsActive(res.data.active);
      if (res.data.urlPath) {
        setIcsLink(`${window.location.origin}${res.data.urlPath}`);
        setStatus(t("icsReady"));
      } else {
        setIcsLink("");
        setStatus(t("icsActiveHidden"));
      }
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
      setIcsActive(false);
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
    const result = await subscribeToPush();
    if (result !== "ok") {
      setError(
        result === "unsupported"
          ? t("pushUnsupported")
          : result === "missing-key"
            ? t("pushMissingKey")
            : result === "denied"
              ? t("pushPermissionDenied")
              : t("genericError"),
      );
      return;
    }
    const statusRes = await getPushStatusAction();
    if (statusRes.ok) setPushCount(statusRes.data.subscriptions);
    setStatus(t("pushEnabled"));
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <h1 className="rp-large-title text-rp-ink">{t("title")}</h1>

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

      {/* Grouped list (Figma page 12, D2). */}
      <ul className="overflow-hidden rounded-rp-md bg-rp-surface">
        <li className={cn(DIVIDER, "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2")}>
          <Globe size={24} strokeWidth={LUCIDE_STROKE} aria-hidden className="shrink-0 text-rp-icon" />
          <span className="rp-row min-w-0 flex-1 text-rp-ink">{t("language")}</span>
          <LanguageSegmented className="w-full sm:w-auto" />
        </li>
        <li className={DIVIDER}>
          <AccessibilityDialog
            trigger={
              <button type="button" className={ROW} data-testid="settings-text-theme">
                <Type size={24} strokeWidth={LUCIDE_STROKE} aria-hidden className="shrink-0 text-rp-icon" />
                <span className="min-w-0 flex-1">{tA11y("title")}</span>
                <ChevronRight size={20} strokeWidth={LUCIDE_STROKE} aria-hidden className="shrink-0 text-rp-muted" />
              </button>
            }
          />
        </li>
      </ul>

      <LocationPrayerCard />

      <ul className="overflow-hidden rounded-rp-md bg-rp-surface">
        <ClockFormatRow />
        <li className={DIVIDER}>
          <Link href="/reminders" className={ROW}>
            <Bell size={24} strokeWidth={LUCIDE_STROKE} aria-hidden className="shrink-0 text-rp-icon" />
            <span className="min-w-0 flex-1">{tNav("remindersShort")}</span>
            <ChevronRight size={20} strokeWidth={LUCIDE_STROKE} aria-hidden className="shrink-0 text-rp-muted" />
          </Link>
        </li>
      </ul>

      {!loading ? (
        <section aria-labelledby="settings-account" className="space-y-2">
          <h2 id="settings-account" className="rp-caption px-4 text-rp-muted">
            {t("account")}
          </h2>
          <ul className="overflow-hidden rounded-rp-md bg-rp-surface">
            {isGuest ? (
              <>
                <li className={DIVIDER}>
                  <Link href="/sign-in" className={ROW}>
                    <LogIn size={24} strokeWidth={LUCIDE_STROKE} aria-hidden className="shrink-0 text-rp-icon" />
                    <span className="min-w-0 flex-1">{t("signInToSync")}</span>
                    <ChevronRight size={20} strokeWidth={LUCIDE_STROKE} aria-hidden className="shrink-0 text-rp-muted" />
                  </Link>
                </li>
                <li className={DIVIDER}>
                  <Link href="/sign-up" onClick={() => track("signup_cta", "/settings")} className={ROW}>
                    <UserPlus size={24} strokeWidth={LUCIDE_STROKE} aria-hidden className="shrink-0 text-rp-icon" />
                    <span className="min-w-0 flex-1">{tAuth("signup")}</span>
                    <ChevronRight size={20} strokeWidth={LUCIDE_STROKE} aria-hidden className="shrink-0 text-rp-muted" />
                  </Link>
                </li>
              </>
            ) : (
              <>
                <li className={cn(DIVIDER, ROW, "hover:bg-transparent")}>
                  <span className="min-w-0 flex-1 truncate text-rp-muted">{user?.email}</span>
                </li>
                <li className={DIVIDER}>
                  <button type="button" onClick={handleLogout} disabled={isPending} className={cn(ROW, "text-destructive")}>
                    <LogOut size={24} strokeWidth={LUCIDE_STROKE} aria-hidden className="shrink-0" />
                    <span className="min-w-0 flex-1">{tAuth("logout")}</span>
                  </button>
                </li>
              </>
            )}
          </ul>
          {isGuest ? <p className="rp-small px-4 text-rp-muted">{t("guestNote")}</p> : null}
        </section>
      ) : null}

      <ul className="overflow-hidden rounded-rp-md bg-rp-surface">
        <li className={DIVIDER}>
          <Link href="/support" className={ROW}>
            <Heart size={24} strokeWidth={LUCIDE_STROKE} aria-hidden className="shrink-0 text-rp-icon" />
            <span className="min-w-0 flex-1">{tNav("support")}</span>
            <ChevronRight size={20} strokeWidth={LUCIDE_STROKE} aria-hidden className="shrink-0 text-rp-muted" />
          </Link>
        </li>
      </ul>

      {!isGuest ? (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("profileSettings")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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

              <Button onClick={saveProfile} disabled={isPending || !profileLoaded}>{tCommon("save")}</Button>
        </CardContent>
      </Card>
      ) : null}

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
                  at: formatDateTime(new Date(googleSyncedAt), locale, clockFormat),
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

          {showSignInNote ? (
            <p id="calendar-signin-reason" className="rp-small rounded-rp-md bg-rp-accent-tint px-3 py-2 text-rp-ink">
              {t("signInRequired")}{" "}
              <Link href="/sign-in" className="inline-flex min-h-[44px] items-center font-semibold text-rp-accent underline-offset-4 hover:underline">
                {tAuth("login")}
              </Link>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={generateIcsLink} disabled={isPending || isGuest} aria-describedby={showSignInNote ? "calendar-signin-reason" : undefined}>
              {t("generateIcs")}
            </Button>
            <Button variant="destructive" onClick={revokeIcsLink} disabled={isPending || isGuest || (!icsLink && !icsActive)} aria-describedby={showSignInNote ? "calendar-signin-reason" : undefined}>
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
          {showSignInNote ? (
            <p id="push-signin-reason" className="rp-small rounded-rp-md bg-rp-accent-tint px-3 py-2 text-rp-ink">
              {t("signInRequired")}{" "}
              <Link href="/sign-in" className="inline-flex min-h-[44px] items-center font-semibold text-rp-accent underline-offset-4 hover:underline">
                {tAuth("login")}
              </Link>
            </p>
          ) : null}
          <Button variant="outline" onClick={enablePush} disabled={isGuest} aria-describedby={showSignInNote ? "push-signin-reason" : undefined}>
            {t("enablePush")}
          </Button>
        </CardContent>
      </Card>

    </div>
  );
}
