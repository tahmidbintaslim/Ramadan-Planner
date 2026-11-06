// Which features are ready to show. A feature that is off is left out of every menu (bottom nav, More sheet, side
// nav, the landing menu), the Home tiles, the landing page and the sitemap; its route still answers a direct URL
// with a calm "coming soon" page and stays noindex. Turn a flag on only when the feature works end to end in
// both languages.
export const FEATURES = {
  /** Edition names were English in the Bengali UI, counts were duplicated and there is no reading flow yet. */
  hadith: false,
  /** Placeholder only. */
  books: false,
  /** Placeholder only. */
  quiz: false,
  duas: true,
  tasbih: true,
  zakat: true,
  reminders: true,
  support: true,
  settings: true,
} as const;

export type FeatureKey = keyof typeof FEATURES;

export function featureOn(key: FeatureKey): boolean {
  return FEATURES[key];
}

/** Paths that belong to a feature that is off (the route and everything below it). */
export function isHiddenPath(path: string): boolean {
  return (Object.keys(FEATURES) as FeatureKey[]).some((k) => !FEATURES[k] && (path === `/${k}` || path.startsWith(`/${k}/`)));
}
