/**
 * Ramadan Day Ordinal Formatter
 *
 * Formats Ramadan day numbers with proper Bengali/English ordinals:
 * - Bengali: প্রথম রোজা, দ্বিতীয় রোজা, etc.
 * - English: Day 1, Day 2, etc.
 */

type Locale = "bn" | "en";

// Bengali ordinal words (1-30)
const BENGALI_ORDINALS: Record<number, string> = {
    1: "প্রথম",
    2: "দ্বিতীয়",
    3: "তৃতীয়",
    4: "চতুর্থ",
    5: "পঞ্চম",
    6: "ষষ্ঠ",
    7: "সপ্তম",
    8: "অষ্টম",
    9: "নবম",
    10: "দশম",
    11: "একাদশ",
    12: "দ্বাদশ",
    13: "ত্রয়োদশ",
    14: "চতুর্দশ",
    15: "পঞ্চদশ",
    16: "ষোড়শ",
    17: "সপ্তদশ",
    18: "অষ্টাদশ",
    19: "ঊনবিংশ",
    20: "বিংশ",
    21: "একবিংশ",
    22: "দ্বাবিংশ",
    23: "ত্রয়োবিংশ",
    24: "চতুর্বিংশ",
    25: "পঞ্চবিংশ",
    26: "ষড়বিংশ",
    27: "সপ্তবিংশ",
    28: "অষ্টাবিংশ",
    29: "ঊনত্রিংশ",
    30: "ত্রিংশ",
};

// Bengali numeric ordinals for compact view (১ম, ২য়, etc.)
const BENGALI_NUMERIC_ORDINALS: Record<number, string> = {
    1: "১ম",
    2: "২য়",
    3: "৩য়",
    4: "৪র্থ",
    5: "৫ম",
    6: "৬ষ্ঠ",
    7: "৭ম",
    8: "৮ম",
    9: "৯ম",
    10: "১০ম",
    11: "১১তম",
    12: "১২তম",
    13: "১৩তম",
    14: "১৪তম",
    15: "১৫তম",
    16: "১৬তম",
    17: "১৭তম",
    18: "১৮তম",
    19: "১৯তম",
    20: "২০তম",
    21: "২১তম",
    22: "২২তম",
    23: "২৩তম",
    24: "২৪তম",
    25: "২৫তম",
    26: "২৬তম",
    27: "২৭তম",
    28: "২৮তম",
    29: "২৯তম",
    30: "৩০তম",
};

/**
 * Format Ramadan day number with ordinal
 *
 * @param day - Ramadan day (1-30)
 * @param locale - Language locale (bn/en)
 * @param format - "full" for "প্রথম রোজা" or "short" for "১ম রমযান"
 * @returns Formatted day string
 */
export function formatRamadanDay(
    day: number,
    locale: Locale = "bn",
    format: "full" | "short" = "short"
): string {
    if (day < 1 || day > 30) {
        return `Day ${day}`;
    }

    if (locale === "bn") {
        if (format === "full") {
            // Full format: "প্রথম রোজা", "দ্বিতীয় রোজা"
            const ordinal = BENGALI_ORDINALS[day] || `${day}তম`;
            return `${ordinal} রোজা`;
        } else {
            // Short format: "১ম রমযান", "২য় রমযান"
            const numericOrdinal = BENGALI_NUMERIC_ORDINALS[day] || `${day}তম`;
            return `${numericOrdinal} রমযান`;
        }
    }

    // English format
    return `Day ${day}`;
}

/**
 * Get just the ordinal part (without "রোজা" or "রমযান")
 *
 * @param day - Ramadan day (1-30)
 * @param locale - Language locale (bn/en)
 * @param format - "full" for "প্রথম" or "short" for "১ম"
 * @returns Ordinal string
 */
export function getRamadanDayOrdinal(
    day: number,
    locale: Locale = "bn",
    format: "full" | "short" = "short"
): string {
    if (day < 1 || day > 30) {
        return String(day);
    }

    if (locale === "bn") {
        if (format === "full") {
            return BENGALI_ORDINALS[day] || `${day}তম`;
        } else {
            return BENGALI_NUMERIC_ORDINALS[day] || `${day}তম`;
        }
    }

    // English: just return the number
    return String(day);
}
