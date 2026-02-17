---
name: add-api-endpoint
description: Add a new Next.js App Router API route with validation, safe errors, Supabase auth checks, docs and tests.
---

# Skill Instructions

When asked to add a new API endpoint:

1. Create route file: `src/app/api/<name>/route.ts`
2. Validate input (query/body) with Zod and strict schemas
3. Verify Supabase auth server-side; never accept client user_id
4. Use consistent JSON response:
   - `{ ok: true, data }`
   - `{ ok: false, error: { code, message } }`
5. Add docs: update `docs/api.md`
6. Add tests (Vitest schema/unit; Playwright if user flow changes)
7. Run:
   - `npm run lint`
   - `npm run test`
