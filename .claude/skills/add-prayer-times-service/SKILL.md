---
name: add-prayer-times-service
description: Add a timings service for prayer/sehri/iftar and Hijri date per location/timezone with caching and fallbacks.
---

# Skill Instructions

1. Create TimingService abstraction (location + date -> timings)
2. Cache per (location, date) with 24h TTL
3. Always display user timezone/location label in UI
4. Add tests for timezone/DST edge cases
5. Update docs:
   - `docs/content.md` or `docs/troubleshooting.md`
6. Run `npm run lint`
