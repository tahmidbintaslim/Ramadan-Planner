# Testing Strategy

## Current state

- Unit tests (Vitest, `npm test`): prayer-time helpers, the Quran service fallback (`src/lib/quran.test.ts`) and the push reminder due window and cron auth (`src/lib/push-schedule.test.ts`).
- `vitest.config.ts` maps the `@/` alias, so tests can `vi.mock("@/lib/prisma")`.
- No Playwright specs yet; the E2E list below is still planned.
- CI (`.github/workflows/ci.yml`) runs lint, type check, unit tests and a production build.

## Unit (Vitest)

- date/time + Ramadan day calculations
- schema validation (Zod) for API inputs
- streak/progress logic

## E2E (Playwright, planned)

- signup/login/logout
- today page: mark prayers + checklist + journal save
- reminder rules: create + disable
- calendar: ICS link generation + google connect (mock)
- language toggle BN/EN persists
