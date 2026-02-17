---
name: add-db-table-rls
description: Create/modify a Supabase table with RLS policies, indexes, and safe access patterns.
---

# Skill Instructions

1. Define schema (columns, constraints, timestamps)
2. Enable RLS
3. Add policies (select/insert/update/delete scoped to auth.uid())
4. Add indexes for common queries (user_id + date)
5. Update `docs/db.md`
6. Ensure server queries scope by session user
7. Run `npm run lint` and tests
