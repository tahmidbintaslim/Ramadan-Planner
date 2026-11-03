// An Islamic night begins at maghrib, so the Nth night starts after the iftar of roza N-1. The odd nights of
// the last ten (21st, 23rd, 25th, 27th, 29th) are where Laylat al-Qadr is sought.

export const ODD_NIGHTS: readonly number[] = [21, 23, 25, 27, 29];

/** The odd night that begins after the iftar of `rozaDay`, or null (20 -> 21, 22 -> 23, ..., 28 -> 29). */
export function oddNightStartingAfter(rozaDay: number): number | null {
  const night = rozaDay + 1;
  return ODD_NIGHTS.includes(night) ? night : null;
}
