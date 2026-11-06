import type { ClockParts } from "@/lib/clock-format";

/**
 * A large clock time whose day period (AM/PM, or রাত after midnight in bn) is set in the small row size, so the
 * digits keep their size inside the hero rings. The period sits in the reading order of the language.
 */
export function ClockTime({ parts }: { parts: ClockParts }) {
  const period = parts.period ? <span className="rp-row align-middle">{parts.period}</span> : null;
  if (!period) return <>{parts.time}</>;
  return parts.periodFirst ? (
    <>
      {period} {parts.time}
    </>
  ) : (
    <>
      {parts.time} {period}
    </>
  );
}
