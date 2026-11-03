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

const BENGALI_ZERO = 0x09e6;

/** Bengali digits (০-৯) to ASCII digits; everything else unchanged. Inputs accept both digit sets. */
export function toAsciiDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - BENGALI_ZERO));
}

/**
 * A number typed in either digit set ("৮৫০০০", "85000", "১২.৫", "-১৫", "85,000"). Grouping commas and spaces are
 * ignored. Returns null when the text is not a number.
 */
export function parseLocalizedNumber(input: string): number | null {
  const clean = toAsciiDigits(input).replace(/[,\s]/g, "").replace(/^[−–]/, "-");
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(clean)) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}
