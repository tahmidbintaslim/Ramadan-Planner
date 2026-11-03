import { useCallback, useMemo, useSyncExternalStore } from "react";
import { isPlanWindow, type PlanWindow } from "./plan-logic";

// Per-device notes about plan items that the plan task/goal records have no field for: the time window chosen
// when an item was added and the suggestion key it came from. Kept in localStorage by item id; an item without a
// note falls back to the title guess (windowFromTitle) and title match (matchDefaultKey).

export const PLAN_ITEM_META_KEY = "rp_plan_item_meta_v1";
const PLAN_ITEM_META_EVENT = "rp:plan-item-meta";

export interface ItemNote {
  window?: PlanWindow;
  key?: string;
}

export type ItemNotes = Record<string, ItemNote>;

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

export function useItemNotes(): {
  notes: ItemNotes;
  remember: (id: string, note: ItemNote) => void;
  forget: (id: string) => void;
} {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  const notes = useMemo(() => parseItemNotes(raw), [raw]);
  const write = useCallback((update: (prev: ItemNotes) => ItemNotes) => {
    try {
      localStorage.setItem(PLAN_ITEM_META_KEY, JSON.stringify(update(parseItemNotes(readRaw()))));
      window.dispatchEvent(new Event(PLAN_ITEM_META_EVENT));
    } catch {
      // Storage unavailable: items fall back to the title guess.
    }
  }, []);
  const remember = useCallback((id: string, note: ItemNote) => write((prev) => ({ ...prev, [id]: note })), [write]);
  const forget = useCallback(
    (id: string) =>
      write((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      }),
    [write],
  );
  return { notes, remember, forget };
}
