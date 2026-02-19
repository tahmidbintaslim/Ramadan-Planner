# Architecture

## Frontend

- Next.js 16 App Router
- Server Components by default; Client Components for interactive trackers/forms
- shadcn/ui + Tailwind

## Backend

- Supabase Auth + Postgres
- RLS for all user-owned tables

## Content vs User Data

- Daily content (Day 1–30) is shared and cacheable.
- User logs are private and strictly user-scoped.

## Key Services

- TimingService: prayer/sehri/iftar + Hijri date per timezone
- ReminderService: rule-based scheduling
- CalendarService: Google integration + ICS feed/export
