# Product Spec — Ramadan Planner (BD-first)

## Target Users

- Primary: Bengali-speaking Muslims (Bangladesh + global)
- Secondary: English-speaking expats

## Key Outcomes

- Help users plan Ramadan goals and track daily practice consistently.
- Provide reliable reminders through push + calendar alerts.

## Core Features

1. Auth: signup/login + social login
2. Daily Planner (Day 1–30):
   - Day header (Ramadan day number, Hijri/Gregorian date)
   - Ayah / Hadith / Dua cards
   - Salah tracker (Fajr..Isha + Taraweeh + Tahajjud)
   - Quran tracker (Para/Surah/Ayah)
   - Daily checklist (dhikr, istighfar, charity, good deeds)
   - "Day task/challenge"
   - Journal: reflection + "My Dua"
3. Plan:
   - Goals
   - Pre-Ramadan checklist
4. Laylatul Qadr Mode:
   - Last 10 nights tracking + boosted reminders
5. Sleep Dhikr checklist
6. Reminders + Announcements
7. Calendar Sync:
   - Google Calendar integration
   - Apple/others via ICS subscribe/export

## Non-Functional Requirements

- Fast on BD networks (mobile-first)
- Privacy-first (RLS, no sensitive leakage)
- Timezone-correct across countries (DST safe)
