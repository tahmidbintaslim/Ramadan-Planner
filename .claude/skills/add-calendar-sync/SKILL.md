---
name: add-calendar-sync
description: Add Google Calendar OAuth sync and ICS feed/export for Apple and other clients, plus documentation.
---

# Skill Instructions

1. Google:
   - OAuth connect flow
   - Create calendar events + reminders
2. ICS:
   - Generate ICS feed/export endpoint
   - Protect with secret key per user
3. UI:
   - Google connect button
   - ICS link card with copy + basic instructions
4. Docs:
   - Update `docs/calendar-sync.md`
5. Tests:
   - unit test ICS generation
   - E2E verifies UI states
6. Run `npm run lint`
