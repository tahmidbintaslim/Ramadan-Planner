---
name: add-reminder-rule
description: Implement reminders end-to-end (UI + DB + scheduling) with timezone correctness and user controls.
---

# Skill Instructions

1. Add/extend reminder_rules storage (RLS, user scoped)
2. Build ReminderRuleBuilder UI with presets and disable/snooze
3. Compute schedules in user timezone (DST-safe)
4. Integrate channels:
   - Push (opt-in)
   - Calendar alerts (Google + ICS)
5. Update docs `docs/reminders.md`
6. Add tests for next-run computation + E2E create/disable
7. Run `npm run lint` and `npm run test`
