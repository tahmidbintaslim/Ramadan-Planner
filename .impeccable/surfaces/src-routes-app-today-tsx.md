---
version: 1
slug: "src-routes-app-today-tsx"
primary_target: "src/routes/_app.today.tsx"
related_targets: []
---

# Surface: app shell and Today (home) screen

Scope: the PWA app shell and its time-aware home screen (Today), the design system it establishes, and the follow-on screens (timetable, day plan, Quran, reminders, support/contribute, last-ten-nights). Mode: Operate. Platform: mobile-first web/PWA, later native.

Audience/job: Bengali-speaking fasting users checking sehri/iftar and the day's plan in short, time-critical moments, one-handed, often in the dark. Constraints: prayer times never obscured; quiet donation asks only at natural moments (after iftar, last ten nights, Eid); offline, light, Bengali-first.

## Direction contract

THESIS: The home screen is the year's Ramadan timetable card come alive: the familiar printed সময়সূচি grid, with today's row lifted and counting down. It refuses the category's card-dashboard of icon tiles and the cream-and-serif spiritual-wellness look.

OWN-WORLD: Two-colour print discipline: timetable white ground, carbon ink, one festival red for "today/now" and state, plus a deep night ink for after-maghrib and the last ten nights. Hairline-ruled tabular grid, Bengali numerals set tabular, heavy grotesque Bengali display for the live time. No gradients, no ornament, no mosque silhouettes; the rule lines are the decoration.

STORY: The visitor instantly sees today's sehri and iftar and how long remains, trusts the source line beneath, then moves to the day's plan or another day by tapping its row; contributing is a quiet row in the same card.

FIRST VIEWPORT: Top bar (Hijri day, district selector). Below, the timetable grid fills the screen: three rows above and below today; today's row expands in red into a live countdown band (next event, time, remaining) with the five prayer times as a sub-row. Primary action (today's plan) sits under the band. Bottom navigation: আজ, সময়সূচি, পরিকল্পনা, কুরআন, আরও.

FORM: Ramadan timetable card, position 1 on my ordered list (IMPECCABLE'S PICK). seed:491b9b64af1a2b60
Signature move: the live row: today's timetable row expands into the countdown band and shifts phase through the day (sehri, prayers, iftar, night), the rest of the grid stays still.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
