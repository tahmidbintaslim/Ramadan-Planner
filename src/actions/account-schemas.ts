// Types shared by the account server functions (client-safe: no server imports).
export type AccountResult<T> = { ok: true; data: T } | { ok: false; error: string };
