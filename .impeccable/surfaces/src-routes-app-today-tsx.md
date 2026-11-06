---
version: 1
slug: "src-routes-app-today-tsx"
primary_target: "src/routes/_app.today.tsx"
related_targets: []
---

# Surface: app shell and Home (Today) screen

Scope: PWA app shell, the time-aware Home screen, and the design system it establishes (timetable, day plan, last ten nights, Quran, sadaqah, onboarding follow it). Mode: Operate. Platform: mobile-first web/PWA, later native.

Audience/job: Bengali-speaking fasting users checking sehri/iftar, the next prayer and the day's plan in short moments, one-handed, often in the dark. Constraints: prayer times never obscured; quiet sadaqah asks only after iftar, the last ten nights and Eid; light, Bengali-first, and what was already opened works offline.

## Direction contract

THESIS: A peaceful, unmistakably Islamic companion: the home screen is a sky that follows the day, with one focus at a time. User-pinned (2026-11-03) from founder references (calm teal Islamic prayer/dua/Quran app concepts); replaces the rejected timetable-card direction.

OWN-WORLD: Mint-mist ground, white soft cards (radius 24, one soft shadow), deep teal primary, muted gold accent for iftar, odd nights and sadaqah. Night mode (Maghrib→Fajr) on deep teal-ink. Three quiet Islamic motifs only: mihrab arch outline, faint 8-point girih lattice at 6–10%, crescent/lantern line icons. Tiro Bangla greetings/headings, Hind Siliguri UI. Pills for buttons and chips.

STORY: The visitor sees the next moment (sehri, prayer or iftar) and how long remains, trusts the source line, then checks the five prayers, the day's plan or a Quran/dua shortcut; sadaqah appears as a gentle gold card at the right moments.

FIRST VIEWPORT: Greeting top bar (Tiro Bangla salam, date, bell). Prayer Hero card (sky gradient per phase, location pill, Hijri date, progress ring with label/time/remaining, source line). Sehri/Iftar pair card. Today's prayers list with the next one tinted. Floating rounded bottom nav: আজ, সময়সূচি, পরিকল্পনা, কুরআন, আরও.

FORM: User-pinned calm Islamic direction (founder references), not a dealt card; earlier roll seed:491b9b64af1a2b60 superseded, safer re-roll round 1.
Signature move: the Prayer Hero's sky and ring change phase through the day (Sehri, Day, Iftar, Night).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Current decisions (2026-11-06, founder)

These amend the contract above; where they differ, they win.

- **Home at 390px, in order:** phase + next prayer (compact hero about 240px: the prayer name and time lead, a small ring shows progress; the large centred ring is desktop only) → Sehri/Iftar → the five prayers (all above the bottom nav at 390x844) → one contextual sourced card (niyyah at sehri, iftar dua near iftar, otherwise the day's ayah) → a small link to today's amal → the tiles → the rule-gated sadaqah card. No trackers, checklist or journal on the Home.
- **Trackers live on /plan:** আজকের আমল, নামাজ ট্র্যাকার (five prayers), কুরআন খতম, আমার লক্ষ্য, রমজান ডায়েরি (collapsed). One record per action.
- **Navigation:** আজ · সময়সূচি · আমল · কুরআন · আরও, always labelled; Hadith, Books and Quiz hidden (`src/config/features.ts`). Approved terminology: PRODUCT.md, "Terminology and navigation".
- **Timetable fallback:** the stored district, else Dhaka (Asia/Dhaka), labelled; never the device's UTC.
- **Text & theme control:** "লেখা ও থিম" with the অ/Aa icon in the More sheet, side nav, landing header, onboarding sky and auth header; no floating buttons.
- **Type:** per locale (bn: Tiro Bangla / Noto Sans Bengali / Noto Serif Bengali; en: Noto Serif Display / Noto Sans / Noto Serif); Arabic Noto Naskh Arabic, Quran ayahs Amiri Quran. This replaces "Tiro Bangla greetings/headings, Hind Siliguri UI" above.

## Design sources

- Figma design system: https://www.figma.com/design/obgy329uiFD871GV1NbuF8
- Icons: Hugeicons stroke-rounded 1.5 (free Islamic set for Islamic meanings; MIT free UI icons for navigation and actions).
- Fonts: as in "Current decisions" and PRODUCT.md, "Design sources".
