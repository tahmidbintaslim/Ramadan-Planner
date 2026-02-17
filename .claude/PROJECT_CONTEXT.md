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

- Supabase Auth + DB with strict RLS
- Timezone correctness globally (including DST)
- Web reminders = push + calendar alerts (Google + ICS)
