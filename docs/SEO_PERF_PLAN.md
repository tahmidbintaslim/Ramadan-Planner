# SEO & Performance Plan

## SEO (Public pages only)

- Localized metadata (BN/EN) with Next.js Metadata API
- OpenGraph + Twitter cards
- Sitemap + robots
- FAQ JSON-LD on FAQ page
- Authenticated routes: noindex

## Performance

- Public pages: static/ISR
- Cache daily content and timing responses
- Avoid heavy client bundles; code-split charts/editors
- Skeletons for user-specific data to prevent CLS

## Acceptance Targets

- LCP < 2.5s on mid-range mobile
- Minimal CLS and fast TTFB via CDN caching
