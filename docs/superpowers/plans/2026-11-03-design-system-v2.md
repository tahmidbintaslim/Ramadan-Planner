# Design system v2 (calm Islamic): implementation plan

**Source of truth:** Figma file `obgy329uiFD871GV1NbuF8` ("Ramadan Planner — Ramadan 2027 Design System & App"). The pages are Foundations, Components, Mobile PWA and Web/Tablet. Direction contract: `.impeccable/surfaces/src-routes-app-today-tsx.md`. Product truth: `PRODUCT.md`. The founder approved both the design and the plan on 2026-11-03.

**Branch:** `claude/tanstack-migration`. This stacks on the TanStack app; production cutover is still Task 12 of the migration plan.

## Global Constraints

- **Figma variables are the token source.** Use the CSS variable names from each variable's WEB code syntax (`--rp-*`). Map the shadcn vars (`--background`, `--primary`, …) onto them so existing components inherit the look.
- **Two modes, Light and Night.** Night applies automatically from Maghrib to Fajr, using the user's location times. A manual override (Light / Night / Auto) is kept in Settings. Keep the existing `.dark` class mechanism (next-themes); the "auto" logic sets it.
- **Fonts:**
  - Tiro Bangla (greetings, H1) and Hind Siliguri (everything else).
  - Self-host them (`@fontsource/*` or files in `public/fonts`), not the Google Fonts CDN, so the PWA works offline.
  - Use `font-display: swap`.
  - Ship only the Bengali + Latin subsets in use.
- **Icons:** the 23 icons from Figma (`Icon/*`) as React SVG components: 24px, stroke 1.6, `currentColor`, `aria-hidden` unless labelled. No icon font.
- **Islamic motifs, three only:**
  - the mihrab arch outline,
  - the 8-point girih lattice at 6–10% opacity (as an inline SVG pattern),
  - crescent/lantern line icons.
  - Nothing else decorative.
- **Never obscure prayer times or the Quran.** Sample/unverified data stays labelled (নমুনা). Every time shows its source line.
- **Sadaqah card rule:** show it only after Maghrib, in the last ten nights, or on Eid, and make it dismissible. Never show it in the Sehri phase or within ±15 min of a prayer.
- **Accessibility:**
  - Text contrast ≥ 4.5:1 (white text on the hero is checked at the lightest gradient stop).
  - Touch targets ≥ 48px.
  - `prefers-reduced-motion` respected.
  - The Bengali `lang` attribute is set.
- **Performance:** no new heavy dependencies. The hero ring and pattern are SVG/CSS. Lighthouse mobile must not regress.
- **Tests:** every pure function (phase engine, sadaqah visibility, Bengali digits) gets Vitest coverage. Existing e2e tests must keep passing, updated only where the UI genuinely changed.
- **Commit trailers:** `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01R2svZ5AMFKKtLeKn6thQm3`.

## Tasks

### Task 1: Tokens, modes and fonts
**Files:** `src/styles/globals.css`, `src/routes/__root.tsx`, `src/components/providers/*` (theme), `package.json` if `@fontsource` is used.
- [ ] Define the `--rp-*` primitive and semantic tokens for Light and `.dark` (Night), with values exactly as in Figma, and map the shadcn vars onto them.
- [ ] Add radius tokens 10/16/24/32/full and `--rp-shadow-soft`.
- [ ] Self-host the fonts and wire them into the root.
- [ ] Acceptance: the existing pages render in the new palette in both modes, no hard-coded old greens remain in components (`rg "#006c40|#fdfbf7"`), and the build and tests pass.

### Task 2: Prayer phase engine (pure)
**Files:** `src/lib/prayer-phase.ts` (+ test). Reuse `src/lib/prayer-times.ts`.
- [ ] `getPrayerPhase(now, timings)` returns `{ phase: "sehri"|"day"|"iftar"|"night", next: {name, at}, remainingMs, progress (0..1), isNight }`.
  - Sehri runs from Isha's end to Fajr. Simplification: night time after midnight until the sehri end counts as Sehri.
  - Day runs from Fajr to one hour before Maghrib.
  - Iftar covers the last hour before Maghrib.
  - Night runs from Maghrib to midnight.
- [ ] `shouldShowSadaqah(now, timings, ramadanDay, dismissedAt)` implements the rule above.
- [ ] `toBengaliDigits` reuses the existing helper if one exists.
- [ ] Acceptance: table-driven tests at boundary minutes.

### Task 3: Icons and motifs
**Files:** `src/components/icons/islamic-icons.tsx`, `src/components/design/girih-pattern.tsx`, `src/components/design/mihrab-arch.tsx`.
- [ ] Copy the SVG paths from the Figma `Icon/*` components.
- [ ] Build the pattern as an SVG `<pattern>` and the arch as an SVG path.
- [ ] Acceptance: an icon test that checks the names, `currentColor` and `aria-hidden`.

### Task 4: Primitive restyle
**Files:** `src/components/ui/button.tsx`, `badge.tsx`, `card.tsx` and a new `chip.tsx`, plus `src/components/design/section-header.tsx`.
- [ ] Button variants: primary (teal pill, 52px), soft (tint), outline, quiet.
- [ ] Chip: default and selected.
- [ ] Card: radius 24 with the soft shadow.
- [ ] Section header: title and action link.
- [ ] Acceptance: no visual breakage on existing pages (Playwright smoke) and the variants are covered in unit tests.

### Task 5: Prayer Hero, Sehri/Iftar pair, Prayer list
**Files:** `src/components/prayer/prayer-hero.tsx`, `sehri-iftar-pair.tsx`, `prayer-list.tsx`.
- [ ] The hero takes the phase-engine output and renders:
  - the per-phase gradient,
  - the girih at 7% opacity and the mihrab arch,
  - the location pill and Hijri date,
  - an SVG progress ring with label, time and remaining time,
  - the source line.
- [ ] The countdown updates every 30 s, with an accessible live region at most once a minute.
- [ ] The prayer list highlights the next prayer and has a bell toggle wired to the existing reminders.
- [ ] Acceptance: component tests for each phase and a reduced-motion check.

### Task 6: App shell
**Files:** `src/components/layout/*` (app-header becomes the greeting top bar; mobile-nav becomes a floating bottom nav; desktop-sidebar is restyled).
- [ ] The five tabs are আজ, সময়সূচি, পরিকল্পনা, কুরআন and আরও (a sheet holding the other routes).
- [ ] Auto Night mode is driven by the phase engine.
- [ ] Acceptance: e2e navigation works and the bottom nav clears content (no overlap).

### Task 7: Home screen
**Files:** `src/routes/_app.today.tsx`, `src/components/today/*` (recompose `today-content.tsx`).
- [ ] Layout: hero, Sehri/Iftar pair, then a phase card (Sehri niyyah or Iftar dua, both with sources), today's prayers, the tiles (Quran, Dua, Tasbih, Zakat), today's plan preview, and the sadaqah card (rule-gated).
- [ ] Keep the existing data flows (guest local storage and signed-in server functions).
- [ ] Desktop: side nav with two columns, as in the Figma Web/Tablet page.

### Task 8: Timetable screen
**Files:** a new `src/routes/_app.timetable.tsx` (public and indexable, added to the sitemap) and `src/components/timetable/*`.
- [ ] The three ten-day sections (decades) as chips, today's row highlighted, odd nights in gold.
- [ ] Share and print actions.
- [ ] Reuse `src/lib/ramadan-timetable.ts`.

### Task 9: Day plan and last ten nights
**Files:** `src/routes/_app.plan.tsx` and its components.
- [ ] A progress ring card, grouped checklist cards and an add-good-deed (আমল) button.
- [ ] When the Ramadan day is 21 or later, show the last-ten-nights view: Night hero, odd-night rows and tonight's practices (আমল).

### Task 10: Quran list, Sadaqah and Contribute
**Files:** `src/routes/_app.quran.index.tsx` and its components, and a new `src/routes/_app.support.tsx`.
- [ ] Quran: a last-read card (teal gradient with arch and pattern), Surah / Para / Page / Bookmark tabs and round-numbered surah rows.
- [ ] Support page:
  - an intro card,
  - a cost ledger with placeholder amounts held in a config file,
  - amount and frequency chips,
  - a bKash/Nagad action (a `tel`/deep-link placeholder, behind a config flag),
  - a card action for the diaspora (placeholder),
  - collaborate links (GitHub repo, translation, mosque partnership, share).
- [ ] Nothing is gated, and there is no Stripe dependency here.

### Task 11: Onboarding and landing
**Files:** the landing page components and a first-run district picker.
- [ ] The welcome sky with arch and crescent, a district input with geolocation, popular district chips and a primary "বিসমিল্লাহ, শুরু করুন" button. No sign-up. The choice is stored locally.
- [ ] The landing page is restyled to the same system. SEO metadata stays intact.

### Task 12: QA, finish review and DESIGN.md
- [ ] Run the Impeccable detector on the changed UI and fix what is mechanical.
- [ ] Capture mobile (390) and desktop (1440) screenshots in both modes.
- [ ] Run the Impeccable finish reviewer and fix its findings.
- [ ] The documenter writes `DESIGN.md` and `.impeccable/design.json`.
- [ ] Run Lighthouse mobile.
- [ ] Update the e2e specs.

## Execution order
Tasks 1→2→3→4→5→6→7, then 8–11 in any order, then 12. Each task gets an implementer and then a reviewer; fix rounds go back to the same implementer.

## Later (separate plans)
- Billing re-scoped to donations: a ledger table, bKash/Nagad once there is a registered entity, Open Collective.
- Migration Task 12: preview verification with Clerk keys and cutover.
- Native app (Expo) reusing the tokens and the phase engine.
