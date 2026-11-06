import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_CLOCK_FORMAT,
  readClockFormat,
  subscribeClockFormat,
  writeClockFormat,
  type ClockFormat,
} from "@/lib/clock-format";

/**
 * The user's clock format, shared by every component (localStorage + an in-page event). The server and the first
 * client render use the default (12-hour), so hydration always matches; a stored 24-hour choice applies right after.
 */
export function useClockFormat(): [ClockFormat, (next: ClockFormat) => void] {
  const format = useSyncExternalStore(subscribeClockFormat, readClockFormat, () => DEFAULT_CLOCK_FORMAT);
  const set = useCallback((next: ClockFormat) => writeClockFormat(next), []);
  return [format, set];
}
