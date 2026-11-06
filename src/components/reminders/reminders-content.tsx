"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { BellIcon } from "@/components/icons/islamic-icons";
import { Card } from "@/components/ui/card";
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

export function RemindersContent() {
  const t = useTranslations("reminders");
  const tCommon = useTranslations("common");
  const tSalah = useTranslations("salah");
  const locale = useLocale();
  const num = (n: number) => formatLocalizedNumber(n, locale);
  const { isGuest, loading } = useAuth();

  const [serverRules, setServerRules] = useState<ReminderRuleDTO[]>([]);
  const {
    data: guestRules,
    updateData: updateGuestRules,
  } = useGuestReminderRules();
  const [newType, setNewType] = useState<ReminderRuleDTO["type"]>("fajr");
  const [newLabel, setNewLabel] = useState("");
  const [newOffset, setNewOffset] = useState(() => formatLocalizedNumber(-15, locale));
  // Offsets as typed in the rule list (so "-" or "" can be typed); the rule keeps the parsed number.
  const [offsetDrafts, setOffsetDrafts] = useState<Record<string, string>>({});
  const [newPush, setNewPush] = useState(true);
  const [newCalendar, setNewCalendar] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const rules = isGuest ? guestRules : serverRules;
  const setAllRules = (
    updater:
      | ReminderRuleDTO[]
      | ((prev: ReminderRuleDTO[]) => ReminderRuleDTO[]),
  ) => {
    if (isGuest) {
      updateGuestRules(updater);
      return;
    }
    setServerRules(updater);
  };
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

  const addRule = () => {
    const channels = [newPush ? "push" : null, newCalendar ? "calendar" : null]
      .filter((value): value is "push" | "calendar" => Boolean(value));

    if (channels.length === 0) {
      setError(t("chooseChannel"));
      return;
    }

    // Either digit set ("-১৫" or "-15"); an invalid draft is an error, never a silent default.
    const offset = parseOffsetMinutes(newOffset);
    if (offset === null) {
      setError(t("offsetInvalid", { limit: num(OFFSET_LIMIT) }));
      return;
    }

    if (isGuest) {
      const next: ReminderRuleDTO = {
        id: crypto.randomUUID(),
        type: newType,
        label: newLabel.trim(),
        offsetMinutes: offset,
        channels,
        enabled: true,
      };
      setAllRules((prev) => [...prev, next]);
      setNewLabel("");
      setNewOffset(formatLocalizedNumber(-15, locale));
      setNewPush(true);
      setNewCalendar(false);
      notifyTrackerUpdate();
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await createReminderRuleAction({
        type: newType,
        label: newLabel.trim(),
        offsetMinutes: offset,
        channels,
        enabled: true,
      });

      if (!res.ok) {
        setError(t("genericError"));
        return;
      }

      setServerRules((prev) => [...prev, res.data]);
      setNewLabel("");
      setNewOffset(formatLocalizedNumber(-15, locale));
      setNewPush(true);
      setNewCalendar(false);
      notifyTrackerUpdate();
    });
  };

  const saveRule = (rule: ReminderRuleDTO) => {
    if (rule.channels.length === 0) {
      setError(t("chooseChannel"));
      return;
    }
    // The offset field keeps what was typed; an invalid draft blocks the save instead of saving 0.
    const draft = offsetDrafts[rule.id];
    if (draft !== undefined && parseOffsetMinutes(draft) === null) {
      setError(t("offsetInvalid", { limit: num(OFFSET_LIMIT) }));
      return;
    }
    setError(null);

    if (isGuest) {
      setAllRules((prev) =>
        prev.map((item) => (item.id === rule.id ? rule : item)),
      );
      notifyTrackerUpdate();
      return;
    }

    startTransition(async () => {
      const res = await updateReminderRuleAction(rule);
      if (!res.ok) {
        setError(t("genericError"));
        return;
      }
      setServerRules((prev) => prev.map((item) => (item.id === rule.id ? res.data : item)));
      notifyTrackerUpdate();
    });
  };

  const removeRule = (id: string) => {
    if (isGuest) {
      setAllRules((prev) => prev.filter((item) => item.id !== id));
      notifyTrackerUpdate();
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
    });
  };

  const typeLabel = (type: string): string => {
    if (type in { sehri: true, iftar: true, custom: true }) {
      return t(type as "sehri" | "iftar" | "custom");
    }
    if (
      type in
      {
        fajr: true,
        dhuhr: true,
        asr: true,
        maghrib: true,
        isha: true,
        taraweeh: true,
        tahajjud: true,
      }
    ) {
      return tSalah(
        type as
          | "fajr"
          | "dhuhr"
          | "asr"
          | "maghrib"
          | "isha"
          | "taraweeh"
          | "tahajjud",
      );
    }
    return type;
  };

  const selectClass = cn(fieldClass, "w-full appearance-auto");

  const channelToggle = (id: string, label: string, checked: boolean, onChange: (checked: boolean) => void) => (
    <label
      htmlFor={id}
      className="flex min-h-12 cursor-pointer items-center gap-3 rounded-rp-md border border-rp-rule bg-rp-surface px-4 text-rp-ink has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring"
    >
      <Checkbox id={id} checked={checked} onCheckedChange={(c) => onChange(Boolean(c))} className="size-5" />
      <span className="rp-row">{label}</span>
    </label>
  );

  const offsetField = (id: string, value: string, onChange: (v: string) => void) => (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="rp-small text-rp-ink">
        {t("offsetLabel")}
      </Label>
      <div className="relative">
        <Input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={`${id}-hint`}
          aria-invalid={parseOffsetMinutes(value) === null}
          className={cn(fieldClass, "pe-20")}
        />
        <span aria-hidden="true" className="rp-small pointer-events-none absolute inset-y-0 end-4 flex items-center text-rp-muted">
          {t("minutesUnit")}
        </span>
      </div>
      <p id={`${id}-hint`} className="rp-caption text-rp-muted">
        {t("offsetHint", { example: num(-15), minutes: num(15) })}
      </p>
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="rp-h1 text-rp-ink">{t("title")}</h1>

      {!loading && isGuest && (
        <p className="rp-small rounded-rp-md bg-rp-accent-tint px-4 py-3 text-rp-ink">{t("guestLocalNotice")}</p>
      )}

      {error && (
        <p role="alert" className="rp-small rounded-rp-md bg-destructive/10 px-4 py-3 text-destructive">
          {error}
        </p>
      )}

      <Card className="px-5" data-testid="reminder-form">
        <h2 className="rp-h2 flex items-center gap-2 text-rp-ink">
          <BellIcon size={24} className="text-rp-accent" />
          {t("addReminder")}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-reminder-type" className="rp-small text-rp-ink">
              {t("typeLabel")}
            </Label>
            <select
              id="new-reminder-type"
              value={newType}
              onChange={(e) => setNewType(e.target.value as ReminderRuleDTO["type"])}
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
            <Label htmlFor="new-reminder-label" className="rp-small text-rp-ink">
              {t("label")}
            </Label>
            <Input
              id="new-reminder-label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder={t("labelPlaceholder")}
              className={fieldClass}
            />
          </div>
          {offsetField("new-reminder-offset", newOffset, setNewOffset)}
        </div>
        <fieldset className="space-y-2">
          <legend className="rp-small mb-1.5 text-rp-ink">{t("channelsLabel")}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {channelToggle("new-reminder-push", t("push"), newPush, setNewPush)}
            {channelToggle("new-reminder-calendar", t("calendar"), newCalendar, setNewCalendar)}
          </div>
        </fieldset>
        <Button onClick={addRule} disabled={isPending} className="w-full sm:w-auto sm:self-start">
          {t("addReminder")}
        </Button>
      </Card>

      <Card className="px-5">
        <h2 className="rp-h2 text-rp-ink">{t("rules")}</h2>
        {rules.length === 0 ? (
          <p className="rp-small text-rp-muted">{t("noRules")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rules.map((rule) => (
              <li key={rule.id} className="space-y-4 rounded-rp-md border border-rp-rule p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`rule-${rule.id}-type`} className="rp-small text-rp-ink">
                      {t("typeLabel")}
                    </Label>
                    <select
                      id={`rule-${rule.id}-type`}
                      value={rule.type}
                      onChange={(e) => {
                        const type = e.target.value as ReminderRuleDTO["type"];
                        setAllRules((prev) => prev.map((item) => (item.id === rule.id ? { ...item, type } : item)));
                      }}
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
                    <Label htmlFor={`rule-${rule.id}-label`} className="rp-small text-rp-ink">
                      {t("label")}
                    </Label>
                    <Input
                      id={`rule-${rule.id}-label`}
                      value={rule.label}
                      onChange={(e) => {
                        const label = e.target.value;
                        setAllRules((prev) => prev.map((item) => (item.id === rule.id ? { ...item, label } : item)));
                      }}
                      placeholder={t("labelPlaceholder")}
                      className={fieldClass}
                    />
                  </div>
                  {offsetField(`rule-${rule.id}-offset`, offsetDrafts[rule.id] ?? num(rule.offsetMinutes), (value) => {
                    setOffsetDrafts((prev) => ({ ...prev, [rule.id]: value }));
                    // Only a valid offset reaches the rule; an invalid draft stays in the field and blocks the save.
                    const offsetMinutes = parseOffsetMinutes(value);
                    if (offsetMinutes === null) return;
                    setAllRules((prev) => prev.map((item) => (item.id === rule.id ? { ...item, offsetMinutes } : item)));
                  })}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {channelToggle(`rule-${rule.id}-enabled`, t("enabled"), rule.enabled, (checked) =>
                    setAllRules((prev) => prev.map((item) => (item.id === rule.id ? { ...item, enabled: checked } : item))),
                  )}
                  {(["push", "calendar"] as const).map((channel) =>
                    channelToggle(`rule-${rule.id}-${channel}`, t(channel), rule.channels.includes(channel), (checked) =>
                      setAllRules((prev) =>
                        prev.map((item) => {
                          if (item.id !== rule.id) return item;
                          const next = new Set(item.channels);
                          if (checked) next.add(channel);
                          else next.delete(channel);
                          return { ...item, channels: Array.from(next) };
                        }),
                      ),
                    ),
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="soft" onClick={() => saveRule(rule)} disabled={isPending}>
                    {tCommon("save")}
                  </Button>
                  <Button variant="quiet" className="text-destructive" onClick={() => removeRule(rule.id)} disabled={isPending}>
                    {tCommon("delete")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
