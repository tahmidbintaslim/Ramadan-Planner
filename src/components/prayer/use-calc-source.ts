import { useTranslations } from "@/i18n/use-intl";

/** "AlAdhan · <method> · <Asr school>" in the UI language, for the method and school a response was calculated with. */
export function useCalcSource(): (calc: { method: number; school: number } | undefined) => string | null {
  const t = useTranslations("calc");
  return (calc) =>
    calc ? t("sourceLine", { method: t(`methods.m${calc.method}`), school: t(calc.school === 1 ? "hanafiAsr" : "standardAsr") }) : null;
}

/** The method name alone. */
export function useMethodName(): (method: number) => string {
  const t = useTranslations("calc");
  return (method) => t(`methods.m${method}`);
}
