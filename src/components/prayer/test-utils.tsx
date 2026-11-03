import type { ReactNode } from "react";
import { IntlProvider } from "use-intl";
import bn from "@/messages/bn.json";
import en from "@/messages/en.json";
import { timingsFromPrayerTimes, zonedTime, type PhaseTimings } from "@/lib/prayer-phase";

export const TZ = "Asia/Dhaka";
export const DATE = "2027-03-01";

export const TIMINGS: PhaseTimings = timingsFromPrayerTimes(
  {
    fajr: "04:55",
    sunrise: "06:10",
    dhuhr: "12:10",
    asr: "16:25",
    maghrib: "18:05",
    isha: "19:20",
    sehri: "04:55",
  },
  DATE,
  TZ,
  "04:54",
) as PhaseTimings;

/** The instant at `hhmm` (HH:mm or HH:mm:ss) on DATE in Dhaka. */
export function at(hhmm: string): Date {
  const [hm, sec] = [hhmm.slice(0, 5), Number(hhmm.slice(6) || 0)];
  return new Date((zonedTime(DATE, hm, TZ) as Date).getTime() + sec * 1000);
}

export function WithIntl({ locale = "bn", children }: { locale?: "bn" | "en"; children: ReactNode }) {
  return (
    <IntlProvider locale={locale} messages={locale === "bn" ? bn : en} timeZone={TZ}>
      {children}
    </IntlProvider>
  );
}
