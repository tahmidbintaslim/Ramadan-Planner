# Gemini CLI Project Standards & Guidelines for Ramadan Planner

This document outlines the key standards, style guides, and operational instructions for developing and maintaining the Ramadan Planner project. Adhering to these guidelines ensures consistent, high-quality output and facilitates efficient collaboration.

## 1. Project Overview & Goal

The Ramadan Planner is a high-performance Next.js 16 (App Router) website tailored for Bangladeshi Muslims (primary language: Bengali) with secondary English support for expats. Its core purpose is to help users plan Ramadan goals, track daily activities, and receive timely reminders and announcements with calendar synchronization and dynamic date/time calculations based on location and timezone.

## 2. Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS
- **UI Components:** shadcn/ui (preferred for all UI primitives)
- **Backend:** Supabase (Auth + Postgres DB)
- **ORM:** Prisma
- **Internationalization:** `next-intl` (BN primary, EN secondary)
- **State Management:** Zustand
- **Date/Time:** `date-fns`, `date-fns-tz`
- **Input Validation:** Zod
- **Testing:** Playwright (E2E), Vitest (Unit)
- **Hosting:** Vercel

## 3. Development Rules (Non-negotiable)

- **Language:** ALWAYS use TypeScript with strict types (`strict: true` in `tsconfig.json`).
- **UI Components:** Use shadcn/ui components for all UI primitives. **Do not build primitives from scratch unless absolutely necessary.**
- **Styling:** Exclusively use Tailwind utility classes. **Avoid CSS modules or other custom CSS solutions.**
- **Internationalization (i18n):**
  - Bengali (`bn`) is the default locale. English (`en`) is the secondary locale.
  - **No hardcoded user-facing strings in components.** All such strings must use `next-intl` for translation.
  - Ensure i18n keys exist for both BN and EN for all user-facing text.
  - Dates and times must always render in the user's local timezone (DST-safe).
  - User locale and timezone preferences should be stored in their profile settings.
  - Use domain-based namespaces for translation keys (e.g., `common`, `auth`, `dashboard`, `today`, `plan`, `reminders`, `settings`).
- **Data Handling:**
  - **Supabase RLS:** Strictly enforce Row Level Security on all user-owned tables.
  - **Security:** Never trust client-provided `user_id`. Supabase service role keys must never be shipped to the browser.
  - Data segregation: Daily content (Day 1–30) is shared and cacheable. User logs are private and strictly user-scoped.
  - Ensure server queries are scoped by the session user (`auth.uid()`).
- **Code Quality:**
  - After every feature change, run `npm run lint`. All ESLint checks must pass.
  - Utilize Zod for strict schema validation of all API inputs and critical data structures.

## 4. Architectural Defaults

- **Next.js App Router:**
  - Prefer **Server Components** by default.
  - Use **Client Components** only when interactivity (e.g., event listeners, state management, browser APIs) is required.
- **API Routes:**
  - `src/app/api/<name>/route.ts` for new API routes.
  - Validate input (query/body) with Zod and strict schemas.
  - Verify Supabase auth server-side.
  - Consistent JSON response format: `{ ok: true, data }` for success, `{ ok: false, error: { code, message } }` for errors.
- **Public Pages:**
  - **SEO-first:** Implement localized metadata (BN/EN) using Next.js Metadata API, OpenGraph, and Twitter cards.
  - Use static generation (SSG) or Incremental Static Regeneration (ISR) where possible for performance.
  - Generate sitemap and `robots.txt`.
- **Authenticated Pages:**
  - **Privacy-first:** Authenticated routes and auth pages should be `noindex` to prevent search engine indexing.
- **Caching:** Implement robust caching mechanisms for daily content and timing responses (e.g., in-memory cache, Next.js ISR).
- **Performance:** Avoid heavy client bundles; use code-splitting for large components (e.g., charts, editors). Use skeletons for user-specific data to prevent Cumulative Layout Shift (CLS).
- **Logging:** Minimal logging; never log secrets or tokens.
- **Rate Limiting:** Implement rate-limiting for sensitive endpoints (e.g., subscribe, calendar sync).

## 5. Standard Feature Development Workflow

When implementing a new feature or making significant changes:

1.  **Documentation:** Update relevant spec/docs (`PRODUCT_SPEC.md`, `UX_UI_SPEC.md`, `ARCHITECTURE.md`, `SEO_PERF_PLAN.md`, `I18N.md`, `DATA_MODEL.md`, or specific `docs/` files like `api.md`, `calendar-sync.md`, `db.md`, `content.md`, `reminders.md`) if needed.
2.  **Implementation:** Implement minimal, focused code changes.
3.  **Testing:** Add new tests (unit with Vitest, E2E with Playwright) or update existing ones when behavior changes.
4.  **Linting:** Run `npm run lint`. All checks must pass.
5.  **Building:** Run `npm run build`. Build must pass without errors.
6.  **Internationalization:** Ensure BN/EN translations are added for all new user-facing text.
7.  **Performance Check:** Verify performance impact (e.g., bundle size, caching effectiveness).
8.  **RLS/User Scope:** Validate RLS policies and user-scoping for data access.

## 6. Definition of Done (DoD)

A change is considered "done" only when ALL of the following criteria are met:

1.  **UX/UI:** User experience matches shadcn/ui patterns and implements a mobile-first layout.
2.  **i18n:** BN/EN translations are added for all user-facing text.
3.  **Security:** RLS policies and user-scoping for data are validated.
4.  **Linting:** `npm run lint` passes without any warnings or errors.
5.  **Build:** `npm run build` passes successfully.
6.  **Testing:** Tests have been added or updated to cover the new or changed behavior.

## 7. Skill-Specific Instructions

For specific multi-step tasks, refer to the detailed instructions within the skill definitions (e.g., `add-api-endpoint`, `add-ui-screen`, `add-db-table-rls`, `add-reminder-rule`, `add-calendar-sync`, `add-prayer-times-service`, `seed-daily-content`, `i18n-add-language`, `seo-performance-check`). These instructions provide step-by-step guidance for common development tasks.

## 8. Agent Output Format

When providing updates or completing tasks, the agent should structure its output as follows:

- **Summary:** A concise overview of the changes or completed task.
- **Files changed:** A list of all files that were modified, created, or deleted.
- **Risks/Edge Cases:** Any identified risks, potential issues, or edge cases related to the change.
- **Test Checklist:** A list of tests to be performed or verified to confirm the change.
