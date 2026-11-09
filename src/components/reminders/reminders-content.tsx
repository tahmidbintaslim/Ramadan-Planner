"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { BellOff, Plus } from "lucide-react";
import { Link } from "@/components/shared/link";
import { hasPushSubscription, pushSupported, subscribeToPush } from "@/lib/push-subscribe";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { DIVIDER, ROW } from "@/components/settings/location-prayer-card";
import { LUCIDE_STROKE } from "@/components/layout/nav-items";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, fieldClass } from "@/components/ui/input";
import { formatLocalizedNumber } from "@/lib/locale-number";
import { OFFSET_LIMIT, parseOffsetMinutes } from "@/lib/reminder-offset";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/providers/auth-provider";
import { useGuestReminderRules } from "@/lib/guest-reminders";
import {
  createReminderRuleAction,
  deleteReminderRuleAction,
  listReminderRulesAction,
  updateReminderRuleAction,
  type ReminderRuleDTO,
} from "@/actions/planner";
import type { ReminderChannel } from "@/actions/planner-schemas";

const REMINDER_TYPES = [
  "sehri",
  "iftar",
  "fajr",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
  "taraweeh",
  "tahajjud",
  "custom",
] as const;

type Draft = { rule: ReminderRuleDTO; isNew: boolean; offset: string };

export function RemindersContent() {
  const t = useTranslations("reminders");
  const tCommon = useTranslations("common");
  const tSalah = useTranslations("salah");
  const tNav = useTranslations("nav");
  const tAuth = useTranslations("auth");
  const locale = useLocale();
  const num = (n: number) => formatLocalizedNumber(n, locale);
  const { isGuest, loading, user } = useAuth();

  const [serverRules, setServerRules] = useState<ReminderRuleDTO[]>([]);
  const { data: guestRules, updateData: updateGuestRules } = useGuestReminderRules();
  // The edit sheet's working copy: a new rule (Add) or a copy of a listed one (tap a row).
  const [draft, setDraft] = useState<Draft | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // This browser's push state for the banner: unknown until checked; "denied" means only the browser can undo it.
  const [pushState, setPushState] = useState<"unknown" | "on" | "off" | "denied" | "unsupported">("unknown");
  useEffect(() => {
    if (loading || isGuest) return;
    void hasPushSubscription().then((on) =>
      setPushState(!pushSupported() ? "unsupported" : on ? "on" : Notification.permission === "denied" ? "denied" : "off"),
    );
  }, [loading, isGuest]);
  const turnOnPush = () =>
    startTransition(async () => {
      const result = await subscribeToPush();
      setPushState(result === "ok" ? "on" : result === "denied" ? "denied" : "off");
      if (result === "error" || result === "missing-key") setError(t("genericError"));
    });
  const rules = isGuest ? guestRules : serverRules;
  const notifyTrackerUpdate = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("rp-tracker-updated"));
    }
  };

  useEffect(() => {
    if (loading) return;
    if (isGuest) return;

    startTransition(async () => {
      const res = await listReminderRulesAction();
      if (!res.ok) {
        setError(t("genericError"));
        return;
      }
      setServerRules(res.data);
    });
  }, [isGuest, loading, t]);

  /** Create or update one rule (guest: on the device; signed in: on the server). */
  const persist = (rule: ReminderRuleDTO, isNew: boolean, onDone?: () => void) => {
    setError(null);
    if (isGuest) {
      updateGuestRules((prev) => (isNew ? [...prev, rule] : prev.map((item) => (item.id === rule.id ? rule : item))));
      notifyTrackerUpdate();
      onDone?.();
      return;
    }
    startTransition(async () => {
      const res = isNew
        ? await createReminderRuleAction({
            type: rule.type,
            label: rule.label,
            offsetMinutes: rule.offsetMinutes,
            channels: rule.channels,
            enabled: rule.enabled,
          })
        : await updateReminderRuleAction(rule);
      if (!res.ok) {
        setError(t("genericError"));
        return;
      }
      setServerRules((prev) => (isNew ? [...prev, res.data] : prev.map((item) => (item.id === rule.id ? res.data : item))));
      notifyTrackerUpdate();
      onDone?.();
    });
  };

  const saveDraft = () => {
    if (!draft) return;
    const channels = isGuest ? draft.rule.channels.filter((c) => c !== "email") : draft.rule.channels;
    if (channels.length === 0) {
      setError(t("chooseChannel"));
      return;
    }
    // Either digit set ("-১৫" or "-15"); an invalid draft is an error, never a silent default.
    const offsetMinutes = parseOffsetMinutes(draft.offset);
    if (offsetMinutes === null) {
      setError(t("offsetInvalid", { limit: num(OFFSET_LIMIT) }));
      return;
    }
    persist({ ...draft.rule, label: draft.rule.label.trim(), channels, offsetMinutes }, draft.isNew, () => setDraft(null));
  };

  const removeRule = (id: string) => {
    setError(null);
    if (isGuest) {
      updateGuestRules((prev) => prev.filter((item) => item.id !== id));
      notifyTrackerUpdate();
      setDraft(null);
      return;
    }

    startTransition(async () => {
      const res = await deleteReminderRuleAction(id);
      if (!res.ok) {
        setError(t("genericError"));
        return;
      }
      setServerRules((prev) => prev.filter((item) => item.id !== id));
      notifyTrackerUpdate();
      setDraft(null);
    });
  };

  const openNew = () => {
    setError(null);
    setDraft({
      rule: { id: crypto.randomUUID(), type: "fajr", label: "", offsetMinutes: -15, channels: ["push"], enabled: true },
      isNew: true,
      offset: num(-15),
    });
  };
  const openRule = (rule: ReminderRuleDTO) => {
    setError(null);
    setDraft({ rule, isNew: false, offset: num(rule.offsetMinutes) });
  };
  const patchDraft = (patch: Partial<ReminderRuleDTO>) => setDraft((d) => (d ? { ...d, rule: { ...d.rule, ...patch } } : d));

  const typeLabel = (type: string): string => {
    if (type in { sehri: true, iftar: true, custom: true }) {
      return t(type as "sehri" | "iftar" | "custom");
    }
    if (type in { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true, taraweeh: true, tahajjud: true }) {
      return tSalah(type as "fajr" | "dhuhr" | "asr" | "maghrib" | "isha" | "taraweeh" | "tahajjud");
    }
    return type;
  };
  // "15 min before · Notification": the second line of a row.
  const ruleSummary = (rule: ReminderRuleDTO) => {
    const when =
      rule.offsetMinutes === 0
        ? t("atTime")
        : t(rule.offsetMinutes < 0 ? "minutesBefore" : "minutesAfter", { n: num(Math.abs(rule.offsetMinutes)) });
    return [when, ...rule.channels.map((c) => t(c))].join(" · ");
  };

  const selectClass = cn(fieldClass, "w-full appearance-auto");

  const channelToggle = (
    id: string,
    label: string,
    checked: boolean,
    onChange: (checked: boolean) => void,
    opts: { disabled?: boolean; hint?: string } = {},
  ) => (
    <label
      htmlFor={id}
      className={cn(
        "flex min-h-12 items-center gap-3 rounded-rp-md border border-rp-rule bg-rp-surface px-4 py-2 text-rp-ink has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring",
        opts.disabled ? "cursor-not-allowed" : "cursor-pointer",
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        disabled={opts.disabled}
        onCheckedChange={(c) => onChange(Boolean(c))}
        aria-describedby={opts.hint ? `${id}-hint` : undefined}
        className="size-5"
      />
      <span className="flex min-w-0 flex-col">
        <span className={cn("rp-row", opts.disabled && "text-rp-muted")}>{label}</span>
        {opts.hint && (
          <span id={`${id}-hint`} className="rp-caption break-words text-rp-muted">
            {opts.hint}
          </span>
        )}
      </span>
    </label>
  );

  // Email goes to the account's address, so guests (no account) can't turn it on.
  const emailOpts = isGuest
    ? { disabled: true, hint: t("emailGuestHint") }
    : { hint: user?.email ? t("emailHintAddress", { email: user.email }) : t("emailHint") };

  const toggleChannel = (channel: ReminderChannel, on: boolean) =>
    setDraft((d) => {
      if (!d) return d;
      const next = new Set(d.rule.channels);
      if (on) next.add(channel);
      else next.delete(channel);
      return { ...d, rule: { ...d.rule, channels: Array.from(next) } };
    });

  // Field ids keep the "new-reminder-" prefix for a new rule (stable for tests and labels).
  const fid = (name: string) => (draft?.isNew ? `new-reminder-${name}` : `rule-${draft?.rule.id}-${name}`);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="rp-large-title text-rp-ink">{tNav("remindersShort")}</h1>

      {!loading && isGuest && (
        <p className="rp-small rounded-rp-md bg-rp-accent-tint px-4 py-3 text-rp-ink" data-testid="reminder-guest-note">
          {t("guestLocalNotice")}{" "}
          <Link href="/sign-in" className="inline-flex min-h-11 items-center font-semibold text-rp-accent underline-offset-4 hover:underline">
            {tAuth("login")}
          </Link>
        </p>
      )}

      {/* Figma D7: signed in but this browser is not subscribed, so nothing would arrive. */}
      {!loading && !isGuest && pushState !== "on" && pushState !== "unknown" ? (
        <div className="flex items-center gap-3 rounded-rp-md bg-rp-surface px-4 py-3" data-testid="reminder-push-banner">
          <BellOff size={24} strokeWidth={LUCIDE_STROKE} aria-hidden className="shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="rp-row text-rp-ink">{t("pushOffTitle")}</p>
            <p className="rp-small text-rp-muted">{pushState === "denied" ? t("pushOffDenied") : t("pushOffBody")}</p>
          </div>
          {pushState === "off" ? (
            <Button variant="soft" size="sm" onClick={turnOnPush} disabled={isPending}>
              {t("pushTurnOn")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {error && !draft && (
        <p role="alert" className="rp-small rounded-rp-md bg-destructive/10 px-4 py-3 text-destructive">
          {error}
        </p>
      )}

      {/* Rules (Figma page 12, D7): tap a row to edit, the switch turns it on or off at once. */}
      <section aria-labelledby="reminder-rules" className="space-y-2">
        <h2 id="reminder-rules" className="rp-caption px-4 text-rp-muted">
          {t("rules")}
        </h2>
        {rules.length === 0 ? (
          <p className="rp-small rounded-rp-md bg-rp-surface px-4 py-3 text-rp-muted">{t("noRules")}</p>
        ) : (
          <>
            <ul className="overflow-hidden rounded-rp-md bg-rp-surface" data-testid="reminder-rules">
              {rules.map((rule) => (
                <li key={rule.id} className={cn(DIVIDER, "flex items-center gap-2 pe-4")}>
                  <button
                    type="button"
                    onClick={() => openRule(rule)}
                    className="flex min-h-[60px] min-w-0 flex-1 flex-col items-start justify-center px-4 py-2 text-left transition-colors hover:bg-rp-accent-tint/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rp-focus"
                  >
                    <span className={cn("rp-row truncate", rule.enabled ? "text-rp-ink" : "text-rp-muted")}>
                      {rule.label || typeLabel(rule.type)}
                    </span>
                    <span className="rp-small truncate text-rp-muted">{ruleSummary(rule)}</span>
                  </button>
                  <Switch
                    checked={rule.enabled}
                    disabled={isPending}
                    onCheckedChange={(enabled) => persist({ ...rule, enabled }, false)}
                    aria-label={rule.label || typeLabel(rule.type)}
                  />
                </li>
              ))}
            </ul>
            <p className="rp-small px-4 text-rp-muted">{t("rowHint")}</p>
          </>
        )}
      </section>

      <ul className="overflow-hidden rounded-rp-md bg-rp-surface">
        <li>
          <button type="button" onClick={openNew} className={cn(ROW, "text-rp-accent")} data-testid="reminder-add">
            <Plus size={24} strokeWidth={LUCIDE_STROKE} aria-hidden className="shrink-0" />
            <span className="min-w-0 flex-1">{t("addReminder")}</span>
          </button>
        </li>
      </ul>

      <Sheet open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-rp-xl" data-testid="reminder-form">
          <SheetHeader>
            <SheetTitle>{draft?.isNew ? t("addReminder") : t("editReminder")}</SheetTitle>
            <SheetDescription className="sr-only">{t("channelsLabel")}</SheetDescription>
          </SheetHeader>
          {draft ? (
            <div className="flex flex-col gap-4 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              {error && (
                <p role="alert" className="rp-small rounded-rp-md bg-destructive/10 px-4 py-3 text-destructive">
                  {error}
                </p>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={fid("type")} className="rp-small text-rp-ink">
                    {t("typeLabel")}
                  </Label>
                  <select
                    id={fid("type")}
                    value={draft.rule.type}
                    onChange={(e) => patchDraft({ type: e.target.value as ReminderRuleDTO["type"] })}
                    className={selectClass}
                  >
                    {REMINDER_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {typeLabel(type)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={fid("label")} className="rp-small text-rp-ink">
                    {t("label")}
                  </Label>
                  <Input
                    id={fid("label")}
                    value={draft.rule.label}
                    onChange={(e) => patchDraft({ label: e.target.value })}
                    placeholder={t("labelPlaceholder")}
                    className={fieldClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={fid("offset")} className="rp-small text-rp-ink">
                    {t("offsetLabel")}
                  </Label>
                  <div className="relative">
                    <Input
                      id={fid("offset")}
                      inputMode="numeric"
                      autoComplete="off"
                      value={draft.offset}
                      onChange={(e) => {
                        const offset = e.target.value;
                        setDraft((d) => (d ? { ...d, offset } : d));
                      }}
                      aria-describedby={`${fid("offset")}-hint`}
                      aria-invalid={parseOffsetMinutes(draft.offset) === null}
                      className={cn(fieldClass, "pe-20")}
                    />
                    <span aria-hidden="true" className="rp-small pointer-events-none absolute inset-y-0 end-4 flex items-center text-rp-muted">
                      {t("minutesUnit")}
                    </span>
                  </div>
                  <p id={`${fid("offset")}-hint`} className="rp-caption text-rp-muted">
                    {t("offsetHint", { example: num(-15), minutes: num(15) })}
                  </p>
                </div>
              </div>
              <fieldset className="space-y-2">
                <legend className="rp-small mb-1.5 text-rp-ink">{t("channelsLabel")}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {channelToggle(fid("push"), t("push"), draft.rule.channels.includes("push"), (c) => toggleChannel("push", c))}
                  {channelToggle(fid("calendar"), t("calendar"), draft.rule.channels.includes("calendar"), (c) =>
                    toggleChannel("calendar", c),
                  )}
                  {channelToggle(
                    fid("email"),
                    t("email"),
                    draft.rule.channels.includes("email") && !isGuest,
                    (c) => toggleChannel("email", c),
                    emailOpts,
                  )}
                </div>
              </fieldset>
              <Button onClick={saveDraft} disabled={isPending} className="w-full">
                {draft.isNew ? t("addReminder") : tCommon("save")}
              </Button>
              {!draft.isNew ? (
                <Button variant="quiet" className="w-full text-destructive" onClick={() => removeRule(draft.rule.id)} disabled={isPending}>
                  {tCommon("delete")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
