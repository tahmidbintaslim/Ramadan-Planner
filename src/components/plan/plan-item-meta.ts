import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { isPlanWindow, type PlanWindow } from "./plan-logic";

// Per-device notes about plan items that the plan task/goal records have no field for: the time window chosen
// when an item was added and the suggestion key it came from. Kept in localStorage by item id; an item without a
// note falls back to the title guess (windowFromTitle) and title match (matchDefaultKey).

export const PLAN_ITEM_META_KEY = "rp_plan_item_meta_v1";
const PLAN_ITEM_META_EVENT = "rp:plan-item-meta";

export interface ItemNote {
  window?: PlanWindow;
  key?: string;
  /** Day (YYYY-MM-DD) a goal was last ticked; goal records have no date field. */
  doneOn?: string;
}

export type ItemNotes = Record<string, ItemNote>;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Notes without the ids that no longer exist (`keep` = ids to keep regardless, e.g. one just created). */
export function pruneItemNotes(notes: ItemNotes, liveIds: ReadonlySet<string> | null, keep: readonly string[] = []): ItemNotes {
  if (!liveIds) return notes;
  const out: ItemNotes = {};
  for (const [id, note] of Object.entries(notes)) if (liveIds.has(id) || keep.includes(id)) out[id] = note;
  return out;
}

/** Validated notes from a stored JSON string (unknown entries dropped). */
export function parseItemNotes(raw: string | null): ItemNotes {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: ItemNotes = {};
    for (const [id, note] of Object.entries(v as Record<string, unknown>)) {
      if (!note || typeof note !== "object") continue;
      const n = note as Record<string, unknown>;
      out[id] = {
        window: isPlanWindow(n.window) ? n.window : undefined,
        key: typeof n.key === "string" && n.key.length <= 64 ? n.key : undefined,
        doneOn: typeof n.doneOn === "string" && ISO_DAY.test(n.doneOn) ? n.doneOn : undefined,
      };
    }
    return out;
  } catch {
    return {};
  }
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(PLAN_ITEM_META_KEY);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(PLAN_ITEM_META_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(PLAN_ITEM_META_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useItemNotes(liveIds: ReadonlySet<string> | null): {
  notes: ItemNotes;
  remember: (id: string, note: ItemNote) => void;
  forget: (id: string) => void;
} {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  const notes = useMemo(() => parseItemNotes(raw), [raw]);
  // Writes drop the notes of items that are gone (liveIds is null until the list is known).
  const liveRef = useRef(liveIds);
  useEffect(() => {
    liveRef.current = liveIds;
  }, [liveIds]);
  const write = useCallback((update: (prev: ItemNotes) => ItemNotes, keep: readonly string[]) => {
    try {
      const next = pruneItemNotes(update(parseItemNotes(readRaw())), liveRef.current, keep);
      localStorage.setItem(PLAN_ITEM_META_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(PLAN_ITEM_META_EVENT));
    } catch {
      // Storage unavailable: items fall back to the title guess.
    }
  }, []);
  const remember = useCallback(
    (id: string, note: ItemNote) => write((prev) => ({ ...prev, [id]: { ...prev[id], ...note } }), [id]),
    [write],
  );
  const forget = useCallback(
    (id: string) =>
      write((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      }, []),
    [write],
  );
  return { notes, remember, forget };
}
