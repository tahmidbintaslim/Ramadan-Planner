# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Web app and installable PWA first (TanStack Start on Vercel). A native or cross-platform mobile app follows later, so every pattern must translate cleanly to Android (and iOS) native conventions. Not yet decided: which cross-platform stack (open decision).

## Users

- **Primary:** Bengali-speaking Muslims in Bangladesh (students, working adults, families) who want to keep their Ramadan routine on track. Often on low-to-mid-range Android phones and patchy mobile data. They use the app several times a day at fixed moments: sehri before dawn, the five prayers, iftar at sunset, and late nights in the last ten nights.
- **Secondary:** the Bengali diaspora (UK, US, Gulf, Malaysia), who want the same Bengali-first experience in their own time zone. They are the most likely donors.
- **Collaborators:** open-source developers and designers; content volunteers and scholars who translate, write and review; mosques, madrasas and charities; sponsors (CSR, telcos).

## Product Purpose

A calm, Bengali-first Ramadan companion: accurate sehri, iftar and prayer times for the user's location, a daily plan and tracker, Quran and hadith reading, reminders, and guidance for the last ten nights. All of it free.

Success for Ramadan 2027 means:
- people come back every day of the month;
- the times are trusted;
- the community funds and helps build it.

## Positioning

- **Ramadan-specific:** a planner built around the month's rhythm (sehri, iftar, the last ten nights), not another all-in-one Islamic lifestyle app.
- **No barriers:** fully free, no ads, no forced sign-up (guest mode works offline on the device).
- **Openness:** sustained by donations and open collaboration (open source, scholar-reviewed content, mosque partners) instead of a paywall, ads or data sale.

## Operating Context

- Used in short, time-critical moments, often one-handed, in the dark before dawn or just before iftar.
- Shared through WhatsApp, Messenger and Facebook groups.
- Mosques and organisations may share local timetables and events.
- Ramadan 2027 is expected to start around mid-February 2027 (exact date depends on moon sighting); the product must be ready before then.

## Capabilities and Constraints

**Existing capabilities:**
- prayer, sehri and iftar timings with Hijri date;
- Ramadan timetable;
- daily planner and tracker;
- goals and tasks;
- Quran (114 surahs) and hadith reading;
- reminders and web push;
- Google Calendar and ICS calendar sync;
- tasbih;
- zakat calculator;
- admin announcements;
- bilingual Bengali and English (Bengali default);
- guest mode with local storage;
- Clerk sign-in for cloud storage.

**Funding model:**
- All features are free for everyone; donations are optional (one-off or monthly).
- Payment rails: bKash and Nagad locally, card for the diaspora.
- Supporters may be thanked (for example, with a badge), but nothing is ever locked behind payment.
- This replaces the earlier Free/Plus subscription plan; the billing work already built must be re-scoped to donations.

**Collaboration channels:**
- public open-source repository;
- content and scholar review workflow;
- mosque and organisation partnerships;
- sponsor acknowledgement with no ads inside the app.

**Constraints:**
- Prayer times, Quran and core tracking are never obscured or gated.
- Fast on low-end Android and slow networks (small JavaScript payload, offline-capable PWA).
- Every religious text cites its source.

**Open decisions:**
- the native and cross-platform mobile stack;
- the donation processor for Bangladesh;
- the legal entity that receives donations;
- the transparency-report format.

## Brand Commitments

- Name: Ramadan Planner (রমজান প্ল্যানার).
- Bengali first, English second.
- Ad-free and privacy-respecting.
- There is no finished logo asset yet.
- Visual commitment (founder, 2026-11-03): calm, eye-soothing, unmistakably Islamic look in the spirit of the founder's reference concepts (teal/mint, soft rounded cards, mihrab arch, faint geometric pattern, Islamic line icons). Peaceful focus over novelty.

## Evidence on Hand

- **Competitor analysis:** `docs/research/2026-11-03-competitor-analysis.md` (in progress).
- **Earlier strategy:** `docs/STRATEGY.md`, written for the superseded Free/Plus plan.
- **What does not exist yet:**
  - no user testimonials;
  - no usage numbers;
  - no partner mosques or sponsors;
  - no scholar endorsements.

  Never fabricate any of them.

## Product Principles

1. **The moment comes first.** At sehri and iftar the next time and the next action are the whole screen; everything else waits.
2. **Free means free.** No feature is held hostage to donations; asking for support is gentle, honest and never interrupts worship.
3. **Trust is earned with sources.** Accurate times, cited texts, scholar review and open code.
4. **Built with the community.** Every surface leaves a door open to contribute: donate, translate, review, partner or code.
5. **Light enough for every phone.** Works offline, loads fast on slow data, and reads well in Bengali script.

## Accessibility & Inclusion

- WCAG 2.2 AA.
- Bengali script rendering quality (conjuncts, line height) is a first-class requirement.
- Large tap targets for one-handed use in the dark.
- Respects reduced motion and dark mode.
- Usable by older family members: legible sizes and plain language.
