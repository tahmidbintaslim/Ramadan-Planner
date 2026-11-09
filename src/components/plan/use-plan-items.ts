import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { useGuestData } from "@/hooks/use-guest-data";
import { GUEST_PLAN_GOALS_KEY, GUEST_PLAN_TASKS_KEY, migrateGuestPlanList } from "@/lib/guest-plan";
import { signedInFromCookie } from "@/lib/user-location";
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

// The plan's existing data model: prayer goals and plan tasks, in localStorage (persistent lists) for guests and through
// the planner server functions when signed in. Toggles and deletes are optimistic; a row is locked while its
// request is in flight, and a failure rolls back only that row. Task ticks (guest and signed-in) carry the day they belong to
// in `dueDate` (see doneForDay).

const subscribeNoop = () => () => {};
const EMPTY_GOALS: PrayerGoalDTO[] = [];
const EMPTY_TASKS: PlanTaskDTO[] = [];
/** Guest lists live under fixed keys; the first read merges the old day-scoped lists (see guest-plan.ts). */
const GOALS_OPTIONS = { migrate: () => void migrateGuestPlanList(GUEST_PLAN_GOALS_KEY) };
const TASKS_OPTIONS = { migrate: () => void migrateGuestPlanList(GUEST_PLAN_TASKS_KEY) };
/** If the auth client never loads (offline, blocked), the plan works as a guest after this long. */
export const AUTH_WAIT_MS = 3000;

const notifyTrackerUpdate = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("rp-tracker-updated"));
};

type Kind = "task" | "goal";

export interface PlanItemsState {
  goals: PrayerGoalDTO[];
  tasks: PlanTaskDTO[];
  isGuest: boolean;
  /** The list is known (guest storage read, or the first server load finished): editing is allowed. */
  ready: boolean;
  error: boolean;
  /** Ids with a request in flight (their rows are locked). */
  pending: ReadonlySet<string>;
  /** Adds a task; `doneOn` adds it already ticked for that day. Resolves to its id (null on failure). */
  addTask: (title: string, doneOn?: string) => Promise<string | null>;
  addGoal: (title: string, targetCount: number, targetUnit: string) => Promise<string | null>;
  /** Ticks or unticks an item for the day `scopeISO`; `onResult` hears whether it was saved (false = rolled back). */
  toggle: (kind: Kind, id: string, done: boolean, scopeISO: string, onResult?: (ok: boolean) => void) => void;
  /** Resolves true once deleted (immediately for guests). */
  remove: (kind: Kind, id: string) => Promise<boolean>;
  updateTask: (id: string, title: string) => Promise<boolean>;
  updateGoal: (id: string, title: string, targetCount: number) => Promise<boolean>;
}

/** Re-insert `item` at `index` unless it is already back. */
function reinsert<T extends { id: string }>(list: T[], item: T, index: number): T[] {
  if (list.some((x) => x.id === item.id)) return list;
  const next = [...list];
  next.splice(Math.min(index, next.length), 0, item);
  return next;
}

export function usePlanItems(): PlanItemsState {
  const { isGuest, loading } = useAuth();
  const [serverGoals, setServerGoals] = useState<PrayerGoalDTO[]>([]);
  const [serverTasks, setServerTasks] = useState<PlanTaskDTO[]>([]);
  const [serverLoaded, setServerLoaded] = useState(false);
  const { data: guestGoals, updateData: updateGuestGoals } = useGuestData<PrayerGoalDTO[]>(GUEST_PLAN_GOALS_KEY, EMPTY_GOALS, GOALS_OPTIONS);
  const { data: guestTasks, updateData: updateGuestTasks } = useGuestData<PlanTaskDTO[]>(GUEST_PLAN_TASKS_KEY, EMPTY_TASKS, TASKS_OPTIONS);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const [authTimedOut, setAuthTimedOut] = useState(false);

  // Guest data lives in localStorage: the server render and the hydrating render show none, then it appears.
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  // While the auth client loads it is not yet known whose list this is, unless the browser has no session cookie:
  // then it is a guest's (the device list shows at once instead of after the auth client or the timeout).
  // A session cookie never falls back to the device list on a slow auth client: edits made there were dropped once
  // the account loaded. After the wait it shows the error instead.
  const sessionCookie = mounted && signedInFromCookie(document.cookie);
  const guest = isGuest && (!loading || (mounted && !sessionCookie));
  const goals = guest ? (mounted ? guestGoals : EMPTY_GOALS) : serverGoals;
  const tasks = guest ? (mounted ? guestTasks : EMPTY_TASKS) : serverTasks;
  const ready = mounted && (guest || (!loading && !isGuest && serverLoaded));

  useEffect(() => {
    if (!loading) return;
    const id = window.setTimeout(() => setAuthTimedOut(true), AUTH_WAIT_MS);
    return () => window.clearTimeout(id);
  }, [loading]);

  useEffect(() => {
    if (loading || isGuest) return;
    let cancelled = false;
    void Promise.all([listPrayerGoalsAction(), listPlanTasksAction()]).then(([goalsRes, tasksRes]) => {
      if (cancelled) return;
      if (goalsRes.ok) setServerGoals(goalsRes.data);
      if (tasksRes.ok) setServerTasks(tasksRes.data);
      setError(!goalsRes.ok || !tasksRes.ok);
      setServerLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isGuest, loading]);

  // Latest lists for the async handlers.
  const listsRef = useRef({ goals, tasks });
  useEffect(() => {
    listsRef.current = { goals, tasks };
  }, [goals, tasks]);

  const lock = useCallback((id: string, on: boolean) => {
    setPending((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const succeed = useCallback(() => {
    setError(false);
    notifyTrackerUpdate();
  }, []);

  const addTask = useCallback(
    async (title: string, doneOn?: string): Promise<string | null> => {
      const clean = title.trim();
      if (!clean) return null;
      if (guest) {
        const id = crypto.randomUUID();
        updateGuestTasks((prev) => [...prev, { id, title: clean, isDone: Boolean(doneOn), dueDate: doneOn ?? null, sortOrder: prev.length }]);
        succeed();
        return id;
      }
      const res = await createPlanTaskAction({ title: clean });
      if (!res.ok) {
        setError(true);
        return null;
      }
      let created = res.data;
      if (doneOn) {
        const upd = await updatePlanTaskAction({ id: created.id, title: created.title, isDone: true, dueDate: doneOn });
        if (upd.ok) created = upd.data;
      }
      setServerTasks((prev) => [...prev, created]);
      succeed();
      return created.id;
    },
    [guest, updateGuestTasks, succeed],
  );

  const addGoal = useCallback(
    async (title: string, targetCount: number, targetUnit: string): Promise<string | null> => {
      const clean = title.trim();
      if (!clean) return null;
      const count = Math.min(1000, Math.max(1, Math.floor(targetCount) || 1));
      if (guest) {
        const id = crypto.randomUUID();
        updateGuestGoals((prev) => [...prev, { id, title: clean, targetCount: count, targetUnit, isCompleted: false, sortOrder: prev.length }]);
        succeed();
        return id;
      }
      const res = await createPrayerGoalAction({ title: clean, targetCount: count, targetUnit });
      if (!res.ok) {
        setError(true);
        return null;
      }
      setServerGoals((prev) => [...prev, res.data]);
      succeed();
      return res.data.id;
    },
    [guest, updateGuestGoals, succeed],
  );

  const toggle = useCallback(
    (kind: Kind, id: string, done: boolean, scopeISO: string, onResult?: (ok: boolean) => void) => {
      if (pending.has(id)) return;
      if (kind === "task") {
        const before = listsRef.current.tasks.find((x) => x.id === id);
        if (!before) return;
        const next: PlanTaskDTO = { ...before, isDone: done, dueDate: scopeISO };
        if (guest) {
          updateGuestTasks((prev) => prev.map((x) => (x.id === id ? next : x)));
          succeed();
          onResult?.(true);
          return;
        }
        setServerTasks((prev) => prev.map((x) => (x.id === id ? next : x)));
        lock(id, true);
        void updatePlanTaskAction({ id, title: next.title, isDone: done, dueDate: scopeISO })
          .then((res) => {
            if (res.ok) {
              setServerTasks((prev) => prev.map((x) => (x.id === id ? res.data : x)));
              succeed();
            } else {
              setError(true);
              setServerTasks((prev) => prev.map((x) => (x.id === id ? before : x)));
            }
            onResult?.(res.ok);
          })
          .finally(() => lock(id, false));
        return;
      }
      const before = listsRef.current.goals.find((x) => x.id === id);
      if (!before) return;
      const next: PrayerGoalDTO = { ...before, isCompleted: done };
      if (guest) {
        updateGuestGoals((prev) => prev.map((x) => (x.id === id ? next : x)));
        succeed();
        onResult?.(true);
        return;
      }
      setServerGoals((prev) => prev.map((x) => (x.id === id ? next : x)));
      lock(id, true);
      void updatePrayerGoalAction(next)
        .then((res) => {
          if (res.ok) succeed();
          else {
            setError(true);
            setServerGoals((prev) => prev.map((x) => (x.id === id ? before : x)));
          }
          onResult?.(res.ok);
        })
        .finally(() => lock(id, false));
    },
    [guest, pending, lock, succeed, updateGuestTasks, updateGuestGoals],
  );

  const remove = useCallback(
    async (kind: Kind, id: string): Promise<boolean> => {
      if (pending.has(id)) return false;
      if (kind === "task") {
        const index = listsRef.current.tasks.findIndex((x) => x.id === id);
        const removed = listsRef.current.tasks[index];
        if (!removed) return false;
        if (guest) {
          updateGuestTasks((prev) => prev.filter((x) => x.id !== id));
          succeed();
          return true;
        }
        setServerTasks((prev) => prev.filter((x) => x.id !== id));
        lock(id, true);
        const res = await deletePlanTaskAction(id);
        lock(id, false);
        if (!res.ok) {
          setError(true);
          setServerTasks((prev) => reinsert(prev, removed, index));
          return false;
        }
        succeed();
        return true;
      }
      const index = listsRef.current.goals.findIndex((x) => x.id === id);
      const removed = listsRef.current.goals[index];
      if (!removed) return false;
      if (guest) {
        updateGuestGoals((prev) => prev.filter((x) => x.id !== id));
        succeed();
        return true;
      }
      setServerGoals((prev) => prev.filter((x) => x.id !== id));
      lock(id, true);
      const res = await deletePrayerGoalAction(id);
      lock(id, false);
      if (!res.ok) {
        setError(true);
        setServerGoals((prev) => reinsert(prev, removed, index));
        return false;
      }
      succeed();
      return true;
    },
    [guest, pending, lock, succeed, updateGuestTasks, updateGuestGoals],
  );

  const updateTask = useCallback(
    async (id: string, title: string): Promise<boolean> => {
      const clean = title.trim();
      const before = listsRef.current.tasks.find((x) => x.id === id);
      if (!clean || !before) return false;
      if (guest) {
        updateGuestTasks((prev) => prev.map((x) => (x.id === id ? { ...x, title: clean } : x)));
        succeed();
        return true;
      }
      lock(id, true);
      const res = await updatePlanTaskAction({ id, title: clean, isDone: before.isDone });
      lock(id, false);
      if (!res.ok) {
        setError(true);
        return false;
      }
      setServerTasks((prev) => prev.map((x) => (x.id === id ? res.data : x)));
      succeed();
      return true;
    },
    [guest, lock, succeed, updateGuestTasks],
  );

  const updateGoal = useCallback(
    async (id: string, title: string, targetCount: number): Promise<boolean> => {
      const clean = title.trim();
      const before = listsRef.current.goals.find((x) => x.id === id);
      if (!clean || !before) return false;
      const next: PrayerGoalDTO = { ...before, title: clean, targetCount: Math.min(1000, Math.max(1, Math.floor(targetCount) || 1)) };
      if (guest) {
        updateGuestGoals((prev) => prev.map((x) => (x.id === id ? next : x)));
        succeed();
        return true;
      }
      lock(id, true);
      const res = await updatePrayerGoalAction(next);
      lock(id, false);
      if (!res.ok) {
        setError(true);
        return false;
      }
      setServerGoals((prev) => prev.map((x) => (x.id === id ? res.data : x)));
      succeed();
      return true;
    },
    [guest, lock, succeed, updateGuestGoals],
  );

  return { goals, tasks, isGuest: guest, ready, error: error || (authTimedOut && loading && sessionCookie), pending, addTask, addGoal, toggle, remove, updateTask, updateGoal };
}
