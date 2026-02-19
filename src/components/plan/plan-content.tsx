"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/providers/auth-provider";
import { SignupPrompt } from "@/components/shared/signup-prompt";
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

  const [goals, setGoals] = useState<PrayerGoalDTO[]>([]);
  const [tasks, setTasks] = useState<PlanTaskDTO[]>([]);

  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalTargetCount, setNewGoalTargetCount] = useState("1");
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (loading || isGuest) return;

    startTransition(async () => {
      const [goalsRes, tasksRes] = await Promise.all([
        listPrayerGoalsAction(),
        listPlanTasksAction(),
      ]);

      if (goalsRes.ok) setGoals(goalsRes.data);
      if (tasksRes.ok) setTasks(tasksRes.data);

      if (!goalsRes.ok || !tasksRes.ok) {
        setError(t("genericError"));
      }
    });
  }, [isGuest, loading, t]);

  const guardGuest = (): boolean => {
    if (!isGuest) return false;
    setShowPrompt(true);
    return true;
  };

  const addGoal = () => {
    if (guardGuest()) return;

    const title = newGoalTitle.trim();
    const count = Number.parseInt(newGoalTargetCount, 10) || 1;
    if (!title) return;

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

      setGoals((prev) => [...prev, res.data]);
      setNewGoalTitle("");
      setNewGoalTargetCount("1");
    });
  };

  const saveGoal = (goal: PrayerGoalDTO) => {
    if (guardGuest()) return;

    startTransition(async () => {
      const res = await updatePrayerGoalAction(goal);
      if (!res.ok) {
        setError(t("genericError"));
        return;
      }
      setGoals((prev) => prev.map((item) => (item.id === goal.id ? res.data : item)));
    });
  };

  const removeGoal = (id: string) => {
    if (guardGuest()) return;

    startTransition(async () => {
      const res = await deletePrayerGoalAction(id);
      if (!res.ok) {
        setError(t("genericError"));
        return;
      }
      setGoals((prev) => prev.filter((item) => item.id !== id));
    });
  };

  const addTask = () => {
    if (guardGuest()) return;

    const title = newTaskTitle.trim();
    if (!title) return;

    setError(null);
    startTransition(async () => {
      const res = await createPlanTaskAction({ title });
      if (!res.ok) {
        setError(t("genericError"));
        return;
      }
      setTasks((prev) => [...prev, res.data]);
      setNewTaskTitle("");
    });
  };

  const saveTask = (task: PlanTaskDTO) => {
    if (guardGuest()) return;

    startTransition(async () => {
      const res = await updatePlanTaskAction(task);
      if (!res.ok) {
        setError(t("genericError"));
        return;
      }
      setTasks((prev) => prev.map((item) => (item.id === task.id ? res.data : item)));
    });
  };

  const removeTask = (id: string) => {
    if (guardGuest()) return;

    startTransition(async () => {
      const res = await deletePlanTaskAction(id);
      if (!res.ok) {
        setError(t("genericError"));
        return;
      }
      setTasks((prev) => prev.filter((item) => item.id !== id));
    });
  };

  return (
    <>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-primary" />
              {t("goals")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <p className="text-sm text-muted-foreground">{t("noGoals")}</p>
            ) : (
              <div className="space-y-3">
                {goals.map((goal) => (
                  <div key={goal.id} className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={goal.isCompleted}
                        onCheckedChange={(checked) => {
                          setGoals((prev) =>
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
                          setGoals((prev) =>
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
                          setGoals((prev) =>
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
                          setGoals((prev) =>
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

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("preRamadanChecklist")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <p className="text-sm text-muted-foreground">{t("noTasks")}</p>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div key={task.id} className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={task.isDone}
                        onCheckedChange={(checked) => {
                          setTasks((prev) =>
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
                        setTasks((prev) =>
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

      <SignupPrompt open={showPrompt} onClose={() => setShowPrompt(false)} />
    </>
  );
}
