# Project Context

Ramadan Planner for Bengali Muslims (BN primary, EN secondary).
Core screen: Today/Daily Planner combining:

- Ayah/Hadith/Dua cards
- Salah tracker (Fajr..Isha + Taraweeh + Tahajjud)
- Quran tracker (Para/Surah/Ayah)
- Daily checklist (dhikr, istighfar, charity, good deeds)
- Day task/challenge
- Journal: Reflection + My Dua

Key constraints:

- Clerk auth; Postgres on Supabase through Prisma (and supabase-js with the service role for planner data). Queries bypass RLS, so scope every query to the signed-in user in code
- Timezone correctness globally (including DST)
- Web reminders = push + calendar alerts (Google + ICS)
