const BN_LOCALE = "bn-BD-u-nu-beng";

function resolveLocale(locale: string): string {
  return locale.startsWith("bn") ? BN_LOCALE : "en-US";
}

export function formatLocalizedNumber(
  value: number,
  locale: string,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(resolveLocale(locale), {
    useGrouping: false,
    ...options,
  }).format(value);
}

export function localizeAsciiDigits(input: string, locale: string): string {
  if (!locale.startsWith("bn")) return input;

  return input.replace(/\d+(?:\.\d+)?/g, (part) => {
    // Preserve leading zeros by using minimumIntegerDigits equal to
    // the matched integer part length. Handle decimals separately.
    if (part.includes('.')) {
      const [intPart, fracPart] = part.split('.');
      const intVal = Number(intPart);
      const fracVal = fracPart;
      if (!Number.isFinite(intVal)) return part;
      const formattedInt = formatLocalizedNumber(intVal, locale, {
        minimumIntegerDigits: intPart.length,
      });
      return `${formattedInt}.${localizeAsciiDigits(fracVal, locale)}`;
    }

    const intLen = part.length;
    const intVal = Number(part);
    if (!Number.isFinite(intVal)) return part;
    return formatLocalizedNumber(intVal, locale, {
      minimumIntegerDigits: intLen,
    });
  });
}
