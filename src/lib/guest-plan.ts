// Guest plan goals and tasks are persistent lists under fixed keys (localStorage rp_plan_goals / rp_plan_tasks), like
// a signed-in user's rows. They used to be stored under day-scoped keys (rp_plan_goals_<date>), so a guest's plan
// vanished every day. Ticks need no dated key: a task tick carries its day in `dueDate` and a goal tick keeps its day
// in the item note (see plan-logic doneForDay / goalDoneForDay), exactly as for signed-in users.

export const GUEST_PLAN_GOALS_KEY = "plan_goals";
export const GUEST_PLAN_TASKS_KEY = "plan_tasks";
export type GuestPlanFamily = typeof GUEST_PLAN_GOALS_KEY | typeof GUEST_PLAN_TASKS_KEY;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "key" | "length">;
type Item = { id?: unknown; title?: unknown };

/** How many of the newest non-empty dated lists are merged (today's list plus the one before it). */
const MERGE_LISTS = 2;

function readList(storage: StorageLike, key: string): Item[] | null {
  try {
    const v = JSON.parse(storage.getItem(key) ?? "null") as unknown;
    return Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Item[]) : null;
  } catch {
    return null;
  }
}

const titleKey = (item: Item) => (typeof item.title === "string" ? item.title.trim().toLowerCase() : "");

/**
 * One-time migration to the fixed key `rp_<family>`: merges the newest non-empty dated lists (the newest first, so
 * its version of an item wins; the day before fills in what is missing, which also covers a day split between the
 * old UTC key and the local one). Items are matched by id, then by title (the old lists were re-created each day,
 * so the same item can appear with a new id). Does nothing once the fixed key exists. The dated keys are left
 * alone; the 7-day prune expires them. Returns true when it wrote a non-empty list. Never throws.
 */
export function migrateGuestPlanList(
  family: GuestPlanFamily,
  storage: StorageLike | undefined = typeof window === "undefined" ? undefined : window.localStorage,
): boolean {
  if (!storage) return false;
  const fixedKey = `rp_${family}`;
  try {
    if (storage.getItem(fixedKey) !== null) return false;
    const pattern = new RegExp(`^${fixedKey}_(\\d{4}-\\d{2}-\\d{2})$`);
    const dated: { key: string; date: string }[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      const m = key ? pattern.exec(key) : null;
      if (key && m) dated.push({ key, date: m[1] });
    }
    if (dated.length === 0) return false;
    dated.sort((a, b) => b.date.localeCompare(a.date));

    const lists = dated
      .map(({ key }) => readList(storage, key))
      .filter((list): list is Item[] => list !== null && list.length > 0)
      .slice(0, MERGE_LISTS);

    const merged: Item[] = [];
    const ids = new Set<unknown>();
    const titles = new Set<string>();
    for (const list of lists) {
      for (const item of list) {
        const title = titleKey(item);
        if (ids.has(item.id) || (title && titles.has(title))) continue;
        ids.add(item.id);
        if (title) titles.add(title);
        merged.push(item);
      }
    }
    storage.setItem(fixedKey, JSON.stringify(merged.map((item, i) => ({ ...item, sortOrder: i }))));
    return merged.length > 0;
  } catch {
    return false;
  }
}
