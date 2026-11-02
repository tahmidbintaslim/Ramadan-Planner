// Types shared by the integrations server functions (client-safe: no server imports).
export type IntegrationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface GoogleCalendarStatusDTO {
  connected: boolean;
  email: string | null;
  syncedAt: string | null;
}
