// TEMPORARY (TanStack migration Task 1): keeps the Next-only `fetch(url, { next: { revalidate } })` option
// type-checking until Task 6 removes it from src/lib/*. Delete this file in Task 6/11.
interface RequestInit {
  next?: { revalidate?: number | false; tags?: string[] };
}
