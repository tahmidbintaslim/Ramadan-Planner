"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckSquare, Sparkles, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/providers/auth-provider";
import { getTodayKey, useGuestData } from "@/hooks/use-guest-data";
import {
  createPlanTaskAction,
  createPrayerGoalAction,
  deletePlanTaskAction,
  deletePrayerGoalAction,
  listPlanTasksAction,
  listPrayerGoalsAction,
  updatePlanTaskAction,
  updatePrayerGoalAction,
  type PlanTaskDTO,
  type PrayerGoalDTO,
} from "@/actions/planner";

export function PlanContent() {
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  const { isGuest, loading } = useAuth();

  const [serverGoals, setServerGoals] = useState<PrayerGoalDTO[]>([]);
  const [serverTasks, setServerTasks] = useState<PlanTaskDTO[]>([]);
  const {
    data: guestGoals,
    updateData: updateGuestGoals,
  } = useGuestData<PrayerGoalDTO[]>(getTodayKey("plan_goals"), []);
  const {
    data: guestTasks,
    updateData: updateGuestTasks,
  } = useGuestData<PlanTaskDTO[]>(getTodayKey("plan_tasks"), []);

  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalTargetCount, setNewGoalTargetCount] = useState("1");
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const goals = isGuest ? guestGoals : serverGoals;
  const tasks = isGuest ? guestTasks : serverTasks;

  const setAllGoals = (
    updater:
      | PrayerGoalDTO[]
      | ((prev: PrayerGoalDTO[]) => PrayerGoalDTO[]),
  ) => {
    if (isGuest) {
      updateGuestGoals(updater);
      return;
    }
    setServerGoals(updater);
  };

  const setAllTasks = (
    updater: PlanTaskDTO[] | ((prev: PlanTaskDTO[]) => PlanTaskDTO[]),
  ) => {
    if (isGuest) {
      updateGuestTasks(updater);
      return;
    }
    setServerTasks(updater);
  };
  const notifyTrackerUpdate = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("rp-tracker-updated"));
    }
  };

  const goalTemplates = [
    { title: t("templateGoalQuran"), targetCount: 2 },
    { title: t("templateGoalHadith"), targetCount: 1 },
    { title: t("templateGoalDhikr"), targetCount: 100 },
    { title: t("templateGoalDua"), targetCount: 5 },
  ];
  const recommendedGoal = {
    title: t("recommendedGoalName"),
    targetCount: 1,
    targetUnit: t("recommendedGoalUnit"),
  };

  const checklistTemplates = [
    t("templateTaskMealPlan"),
    t("templateTaskSleep"),
    t("templateTaskFamily"),
    t("templateTaskCharity"),
  ];

  useEffect(() => {
    if (loading) return;
    if (isGuest) return;

    startTransition(async () => {
      const [goalsRes, tasksRes] = await Promise.all([
        listPrayerGoalsAction(),
        listPlanTasksAction(),
      ]);

      if (goalsRes.ok) setServerGoals(goalsRes.data);
      if (tasksRes.ok) setServerTasks(tasksRes.data);

      if (!goalsRes.ok || !tasksRes.ok) {
        setError(t("genericError"));
      }
    });
  }, [isGuest, loading, t]);

  const addGoal = () => {
    const title = newGoalTitle.trim();
    const count = Number.parseInt(newGoalTargetCount, 10) || 1;
    if (!title) return;

    if (isGuest) {
      const next: PrayerGoalDTO = {
        id: crypto.randomUUID(),
        title,
        targetCount: Math.max(1, count),
        targetUnit: t("defaultTargetUnit"),
        isCompleted: false,
        sortOrder: goals.length,
      };
      setAllGoals((prev) => [...prev, next]);
      setNewGoalTitle("");
      setNewGoalTargetCount("1");
      notifyTrackerUpdate();
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await createPrayerGoalAction({
        title,
        targetCount: Math.max(1, count),
        targetUnit: t("defaultTargetUnit"),
      });

      if (!res.ok) {
        setError(t("genericError"));
        return;
      }

      setServerGoals((prev) => [...prev, res.data]);
      setNewGoalTitle("");
      setNewGoalTargetCount("1");
      notifyTrackerUpdate();
    });
  };

  const addGoalTemplate = (title: string, targetCount: number) => {
    if (isGuest) {
      const next: PrayerGoalDTO = {
        id: crypto.randomUUID(),
        title: title.trim(),
        targetCount: Math.max(1, targetCount),
        targetUnit: t("defaultTargetUnit"),
        isCompleted: false,
        sortOrder: goals.length,
      };
      setAllGoals((prev) => [...prev, next]);
      notifyTrackerUpdate();
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await createPrayerGoalAction({
        title: title.trim(),
        targetCount: Math.max(1, targetCount),
        targetUnit: t("defaultTargetUnit"),
      });

      if (!res.ok) {
        setError(t("genericError"));
        return;
      }

      setServerGoals((prev) => [...prev, res.data]);
      notifyTrackerUpdate();
    });
  };

  const addRecommendedGoal = () => {
    if (isGuest) {
      const next: PrayerGoalDTO = {
        id: crypto.randomUUID(),
        title: recommendedGoal.title,
        targetCount: recommendedGoal.targetCount,
        targetUnit: recommendedGoal.targetUnit,
        isCompleted: false,
        sortOrder: goals.length,
      };
      setAllGoals((prev) => [...prev, next]);
      notifyTrackerUpdate();
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await createPrayerGoalAction({
        title: recommendedGoal.title,
        targetCount: recommendedGoal.targetCount,
        targetUnit: recommendedGoal.targetUnit,
      });

      if (!res.ok) {
        setError(t("genericError"));
        return;
      }

      setServerGoals((prev) => [...prev, res.data]);
      notifyTrackerUpdate();
    });
  };

  const saveGoal = (goal: PrayerGoalDTO) => {
    if (isGuest) {
      setAllGoals((prev) =>
        prev.map((item) => (item.id === goal.id ? goal : item)),
      );
      notifyTrackerUpdate();
      return;
    }

    startTransition(async () => {
      const res = await updatePrayerGoalAction(goal);
      if (!res.ok) {
        setError(t("genericError"));
        return;
      }
      setServerGoals((prev) => prev.map((item) => (item.id === goal.id ? res.data : item)));
      notifyTrackerUpdate();
    });
  };

  const removeGoal = (id: string) => {
    if (isGuest) {
      setAllGoals((prev) => prev.filter((item) => item.id !== id));
      notifyTrackerUpdate();
      return;
    }

    startTransition(async () => {
      const res = await deletePrayerGoalAction(id);
      if (!res.ok) {
        setError(t("genericError"));
        return;
      }
      setServerGoals((prev) => prev.filter((item) => item.id !== id));
      notifyTrackerUpdate();
    });
  };

  const addTask = () => {
    const title = newTaskTitle.trim();
    if (!title) return;

    if (isGuest) {
      const next: PlanTaskDTO = {
        id: crypto.randomUUID(),
        title,
        isDone: false,
        dueDate: null,
        sortOrder: tasks.length,
      };
      setAllTasks((prev) => [...prev, next]);
      setNewTaskTitle("");
      notifyTrackerUpdate();
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await createPlanTaskAction({ title });
      if (!res.ok) {
        setError(t("genericError"));
        return;
      }
      setServerTasks((prev) => [...prev, res.data]);
      setNewTaskTitle("");
      notifyTrackerUpdate();
    });
  };

  const addTaskTemplate = (title: string) => {
    if (isGuest) {
      const next: PlanTaskDTO = {
        id: crypto.randomUUID(),
        title: title.trim(),
        isDone: false,
        dueDate: null,
        sortOrder: tasks.length,
      };
      setAllTasks((prev) => [...prev, next]);
      notifyTrackerUpdate();
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await createPlanTaskAction({ title: title.trim() });
      if (!res.ok) {
        setError(t("genericError"));
        return;
      }
      setServerTasks((prev) => [...prev, res.data]);
      notifyTrackerUpdate();
    });
  };

  const saveTask = (task: PlanTaskDTO) => {
    if (isGuest) {
      setAllTasks((prev) =>
        prev.map((item) => (item.id === task.id ? task : item)),
      );
      notifyTrackerUpdate();
      return;
    }

    startTransition(async () => {
      const res = await updatePlanTaskAction(task);
      if (!res.ok) {
        setError(t("genericError"));
        return;
      }
      setServerTasks((prev) => prev.map((item) => (item.id === task.id ? res.data : item)));
      notifyTrackerUpdate();
    });
  };

  const removeTask = (id: string) => {
    if (isGuest) {
      setAllTasks((prev) => prev.filter((item) => item.id !== id));
      notifyTrackerUpdate();
      return;
    }

    startTransition(async () => {
      const res = await deletePlanTaskAction(id);
      if (!res.ok) {
        setError(t("genericError"));
        return;
      }
      setServerTasks((prev) => prev.filter((item) => item.id !== id));
      notifyTrackerUpdate();
    });
  };

  return (
    <>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("plannerSubtitle")}</p>
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

        <Card className="surface-soft border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              {t("gettingStarted")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>{t("guideStep1")}</p>
            <p>{t("guideStep2")}</p>
            <p>{t("guideStep3")}</p>
          </CardContent>
        </Card>

        <Card className="surface-soft border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-primary" />
              {t("goals")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">{t("recommendedGoalTitle")}</p>
                  <p className="text-xs text-muted-foreground">{t("recommendedGoalDesc")}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={addRecommendedGoal}
                  disabled={isPending}
                >
                  {t("addRecommendedGoal")}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {t("quickGoalTemplates")}
              </p>
              <div className="flex flex-wrap gap-2">
                {goalTemplates.map((template) => (
                  <Button
                    key={template.title}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => addGoalTemplate(template.title, template.targetCount)}
                    className="h-8"
                  >
                    {template.title}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
              <Input
                value={newGoalTitle}
                onChange={(e) => setNewGoalTitle(e.target.value)}
                placeholder={t("goalTitle")}
              />
              <Input
                type="number"
                min="1"
                value={newGoalTargetCount}
                onChange={(e) => setNewGoalTargetCount(e.target.value)}
                placeholder={t("targetCount")}
              />
              <Button onClick={addGoal} disabled={isPending}>
                {t("addGoal")}
              </Button>
            </div>

            {goals.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/80 bg-background/60 p-4">
                <p className="text-sm font-medium">{t("noGoals")}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("noGoalsHint")}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {goals.map((goal) => (
                  <div key={goal.id} className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={goal.isCompleted}
                        onCheckedChange={(checked) => {
                          setAllGoals((prev) =>
                            prev.map((item) =>
                              item.id === goal.id
                                ? { ...item, isCompleted: Boolean(checked) }
                                : item,
                            ),
                          );
                        }}
                      />
                      <Label className="text-xs text-muted-foreground">
                        {t("completed")}
                      </Label>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[1fr_140px_120px]">
                      <Input
                        value={goal.title}
                        onChange={(e) => {
                          const value = e.target.value;
                          setAllGoals((prev) =>
                            prev.map((item) =>
                              item.id === goal.id ? { ...item, title: value } : item,
                            ),
                          );
                        }}
                      />
                      <Input
                        type="number"
                        min="1"
                        value={String(goal.targetCount)}
                        onChange={(e) => {
                          const value = Math.max(
                            1,
                            Number.parseInt(e.target.value || "1", 10) || 1,
                          );
                          setAllGoals((prev) =>
                            prev.map((item) =>
                              item.id === goal.id
                                ? { ...item, targetCount: value }
                                : item,
                            ),
                          );
                        }}
                      />
                      <Input
                        value={goal.targetUnit}
                        onChange={(e) => {
                          const value = e.target.value;
                          setAllGoals((prev) =>
                            prev.map((item) =>
                              item.id === goal.id
                                ? { ...item, targetUnit: value }
                                : item,
                            ),
                          );
                        }}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => saveGoal(goal)}
                        disabled={isPending}
                      >
                        {tCommon("save")}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeGoal(goal.id)}
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

        <Card className="surface-soft border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckSquare className="h-4 w-4 text-primary" />
              {t("preRamadanChecklist")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {t("quickChecklistTemplates")}
              </p>
              <div className="flex flex-wrap gap-2">
                {checklistTemplates.map((template) => (
                  <Button
                    key={template}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => addTaskTemplate(template)}
                    className="h-8"
                  >
                    {template}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder={t("taskTitle")}
              />
              <Button onClick={addTask} disabled={isPending}>
                {t("addTask")}
              </Button>
            </div>

            {tasks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/80 bg-background/60 p-4">
                <p className="text-sm font-medium">{t("noTasks")}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("noTasksHint")}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div key={task.id} className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={task.isDone}
                        onCheckedChange={(checked) => {
                          setAllTasks((prev) =>
                            prev.map((item) =>
                              item.id === task.id
                                ? { ...item, isDone: Boolean(checked) }
                                : item,
                            ),
                          );
                        }}
                      />
                      <Label className="text-xs text-muted-foreground">
                        {t("completed")}
                      </Label>
                    </div>

                    <Input
                      value={task.title}
                      onChange={(e) => {
                        const value = e.target.value;
                        setAllTasks((prev) =>
                          prev.map((item) =>
                            item.id === task.id ? { ...item, title: value } : item,
                          ),
                        );
                      }}
                    />

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => saveTask(task)}
                        disabled={isPending}
                      >
                        {tCommon("save")}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeTask(task.id)}
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
