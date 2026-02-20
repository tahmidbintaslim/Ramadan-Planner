"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/providers/auth-provider";
import { getTodayKey, useGuestData } from "@/hooks/use-guest-data";
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
  const { isGuest, loading } = useAuth();

  const [serverRules, setServerRules] = useState<ReminderRuleDTO[]>([]);
  const {
    data: guestRules,
    updateData: updateGuestRules,
  } = useGuestData<ReminderRuleDTO[]>(getTodayKey("reminder_rules"), []);
  const [newType, setNewType] = useState<ReminderRuleDTO["type"]>("fajr");
  const [newLabel, setNewLabel] = useState("");
  const [newOffset, setNewOffset] = useState("-15");
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

    const offset = Number.parseInt(newOffset, 10);

    if (isGuest) {
      const next: ReminderRuleDTO = {
        id: crypto.randomUUID(),
        type: newType,
        label: newLabel.trim(),
        offsetMinutes: Number.isFinite(offset) ? offset : -15,
        channels,
        enabled: true,
      };
      setAllRules((prev) => [...prev, next]);
      setNewLabel("");
      setNewOffset("-15");
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
        offsetMinutes: Number.isFinite(offset) ? offset : -15,
        channels,
        enabled: true,
      });

      if (!res.ok) {
        setError(t("genericError"));
        return;
      }

      setServerRules((prev) => [...prev, res.data]);
      setNewLabel("");
      setNewOffset("-15");
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

  return (
    <>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        </div>

        {!loading && isGuest && (
          <p className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
            {t("guestLocalNotice")}
          </p>
        )}

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-primary" />
              {t("addReminder")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-4">
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as ReminderRuleDTO["type"])}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {REMINDER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {typeLabel(type)}
                  </option>
                ))}
              </select>

              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder={t("label")}
              />

              <Input
                type="number"
                value={newOffset}
                onChange={(e) => setNewOffset(e.target.value)}
                placeholder={t("offsetMinutes")}
              />

              <Button onClick={addRule} disabled={isPending}>
                {t("addReminder")}
              </Button>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={newPush}
                  onCheckedChange={(checked) => setNewPush(Boolean(checked))}
                />
                <Label>{t("push")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={newCalendar}
                  onCheckedChange={(checked) => setNewCalendar(Boolean(checked))}
                />
                <Label>{t("calendar")}</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("rules")}</CardTitle>
          </CardHeader>
          <CardContent>
            {rules.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noRules")}</p>
            ) : (
              <div className="space-y-3">
                {rules.map((rule) => (
                  <div key={rule.id} className="rounded-lg border p-3 space-y-3">
                    <div className="grid gap-2 md:grid-cols-4">
                      <select
                        value={rule.type}
                        onChange={(e) => {
                          const type = e.target
                            .value as ReminderRuleDTO["type"];
                          setAllRules((prev) =>
                            prev.map((item) =>
                              item.id === rule.id ? { ...item, type } : item,
                            ),
                          );
                        }}
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {REMINDER_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {typeLabel(type)}
                          </option>
                        ))}
                      </select>

                      <Input
                        value={rule.label}
                        onChange={(e) => {
                          const label = e.target.value;
                          setAllRules((prev) =>
                            prev.map((item) =>
                              item.id === rule.id ? { ...item, label } : item,
                            ),
                          );
                        }}
                        placeholder={t("label")}
                      />

                      <Input
                        type="number"
                        value={String(rule.offsetMinutes)}
                        onChange={(e) => {
                          const offsetMinutes = Number.parseInt(e.target.value, 10) || 0;
                          setAllRules((prev) =>
                            prev.map((item) =>
                              item.id === rule.id
                                ? { ...item, offsetMinutes }
                                : item,
                            ),
                          );
                        }}
                        placeholder={t("offsetMinutes")}
                      />

                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={rule.enabled}
                          onCheckedChange={(checked) => {
                            setAllRules((prev) =>
                              prev.map((item) =>
                                item.id === rule.id
                                  ? { ...item, enabled: Boolean(checked) }
                                  : item,
                              ),
                            );
                          }}
                        />
                        <Label>{t("enabled")}</Label>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={rule.channels.includes("push")}
                          onCheckedChange={(checked) => {
                            setAllRules((prev) =>
                              prev.map((item) => {
                                if (item.id !== rule.id) return item;
                                const next = new Set(item.channels);
                                if (checked) next.add("push");
                                else next.delete("push");
                                return { ...item, channels: Array.from(next) };
                              }),
                            );
                          }}
                        />
                        <Label>{t("push")}</Label>
                      </div>

                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={rule.channels.includes("calendar")}
                          onCheckedChange={(checked) => {
                            setAllRules((prev) =>
                              prev.map((item) => {
                                if (item.id !== rule.id) return item;
                                const next = new Set(item.channels);
                                if (checked) next.add("calendar");
                                else next.delete("calendar");
                                return { ...item, channels: Array.from(next) };
                              }),
                            );
                          }}
                        />
                        <Label>{t("calendar")}</Label>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => saveRule(rule)}
                        disabled={isPending}
                      >
                        {tCommon("save")}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeRule(rule.id)}
                        disabled={isPending}
                      >
                        {tCommon("delete")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </>
  );
}
