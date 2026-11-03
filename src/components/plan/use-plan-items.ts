import { useCallback, useEffect, useState, useSyncExternalStore, useTransition } from "react";
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

// The plan's existing data model, unchanged: prayer goals and plan tasks, in localStorage (per day) for guests and
// through the planner server functions when signed in. Toggles and deletes are optimistic and roll back on error.

const subscribeNoop = () => () => {};

const notifyTrackerUpdate = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("rp-tracker-updated"));
};

const EMPTY_GOALS: PrayerGoalDTO[] = [];
const EMPTY_TASKS: PlanTaskDTO[] = [];

export interface PlanItemsState {
  goals: PrayerGoalDTO[];
  tasks: PlanTaskDTO[];
  isGuest: boolean;
  loading: boolean;
  isPending: boolean;
  error: boolean;
  /** Adds a task; resolves to its id (null on failure). */
  addTask: (title: string, isDone?: boolean) => Promise<string | null>;
  /** Adds a goal with a target count; resolves to its id (null on failure). */
  addGoal: (title: string, targetCount: number, targetUnit: string) => Promise<string | null>;
  toggle: (kind: "task" | "goal", id: string, done: boolean) => void;
  remove: (kind: "task" | "goal", id: string) => void;
}

export function usePlanItems(): PlanItemsState {
  const { isGuest, loading } = useAuth();
  const [serverGoals, setServerGoals] = useState<PrayerGoalDTO[]>([]);
  const [serverTasks, setServerTasks] = useState<PlanTaskDTO[]>([]);
  const { data: guestGoals, updateData: updateGuestGoals } = useGuestData<PrayerGoalDTO[]>(getTodayKey("plan_goals"), []);
  const { data: guestTasks, updateData: updateGuestTasks } = useGuestData<PlanTaskDTO[]>(getTodayKey("plan_tasks"), []);
  const [error, setError] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Guest data lives in localStorage: the server render and the hydrating render show none, then it appears.
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const goals = isGuest ? (mounted ? guestGoals : EMPTY_GOALS) : serverGoals;
  const tasks = isGuest ? (mounted ? guestTasks : EMPTY_TASKS) : serverTasks;

  useEffect(() => {
    if (loading || isGuest) return;
    startTransition(async () => {
      const [goalsRes, tasksRes] = await Promise.all([listPrayerGoalsAction(), listPlanTasksAction()]);
      if (goalsRes.ok) setServerGoals(goalsRes.data);
      if (tasksRes.ok) setServerTasks(tasksRes.data);
      if (!goalsRes.ok || !tasksRes.ok) setError(true);
    });
  }, [isGuest, loading]);

  const setGoals = isGuest ? updateGuestGoals : setServerGoals;
  const setTasks = isGuest ? updateGuestTasks : setServerTasks;

  const addTask = useCallback(
    async (title: string, isDone = false): Promise<string | null> => {
      const clean = title.trim();
      if (!clean) return null;
      if (isGuest) {
        const id = crypto.randomUUID();
        updateGuestTasks((prev) => [...prev, { id, title: clean, isDone, dueDate: null, sortOrder: prev.length }]);
        notifyTrackerUpdate();
        return id;
      }
      setError(false);
      const res = await createPlanTaskAction({ title: clean });
      if (!res.ok) {
        setError(true);
        return null;
      }
      let created = res.data;
      if (isDone) {
        const upd = await updatePlanTaskAction({ ...created, isDone: true });
        if (upd.ok) created = upd.data;
      }
      setServerTasks((prev) => [...prev, created]);
      notifyTrackerUpdate();
      return created.id;
    },
    [isGuest, updateGuestTasks],
  );

  const addGoal = useCallback(
    async (title: string, targetCount: number, targetUnit: string): Promise<string | null> => {
      const clean = title.trim();
      if (!clean) return null;
      const count = Math.max(1, Math.floor(targetCount) || 1);
      if (isGuest) {
        const id = crypto.randomUUID();
        updateGuestGoals((prev) => [
          ...prev,
          { id, title: clean, targetCount: count, targetUnit, isCompleted: false, sortOrder: prev.length },
        ]);
        notifyTrackerUpdate();
        return id;
      }
      setError(false);
      const res = await createPrayerGoalAction({ title: clean, targetCount: count, targetUnit });
      if (!res.ok) {
        setError(true);
        return null;
      }
      setServerGoals((prev) => [...prev, res.data]);
      notifyTrackerUpdate();
      return res.data.id;
    },
    [isGuest, updateGuestGoals],
  );

  const toggle = useCallback(
    (kind: "task" | "goal", id: string, done: boolean) => {
      if (kind === "task") {
        const before = tasks.find((x) => x.id === id);
        if (!before) return;
        const next = { ...before, isDone: done };
        setTasks((prev) => prev.map((x) => (x.id === id ? next : x)));
        notifyTrackerUpdate();
        if (isGuest) return;
        startTransition(async () => {
          const res = await updatePlanTaskAction(next);
          if (!res.ok) {
            setError(true);
            setServerTasks((prev) => prev.map((x) => (x.id === id ? before : x)));
          }
        });
        return;
      }
      const before = goals.find((x) => x.id === id);
      if (!before) return;
      const next = { ...before, isCompleted: done };
      setGoals((prev) => prev.map((x) => (x.id === id ? next : x)));
      notifyTrackerUpdate();
      if (isGuest) return;
      startTransition(async () => {
        const res = await updatePrayerGoalAction(next);
        if (!res.ok) {
          setError(true);
          setServerGoals((prev) => prev.map((x) => (x.id === id ? before : x)));
        }
      });
    },
    [goals, tasks, isGuest, setGoals, setTasks],
  );

  const remove = useCallback(
    (kind: "task" | "goal", id: string) => {
      if (kind === "task") {
        const prevTasks = tasks;
        setTasks((prev) => prev.filter((x) => x.id !== id));
        notifyTrackerUpdate();
        if (isGuest) return;
        startTransition(async () => {
          const res = await deletePlanTaskAction(id);
          if (!res.ok) {
            setError(true);
            setServerTasks(prevTasks);
          }
        });
        return;
      }
      const prevGoals = goals;
      setGoals((prev) => prev.filter((x) => x.id !== id));
      notifyTrackerUpdate();
      if (isGuest) return;
      startTransition(async () => {
        const res = await deletePrayerGoalAction(id);
        if (!res.ok) {
          setError(true);
          setServerGoals(prevGoals);
        }
      });
    },
    [goals, tasks, isGuest, setGoals, setTasks],
  );

  return { goals, tasks, isGuest, loading, isPending, error, addTask, addGoal, toggle, remove };
}
