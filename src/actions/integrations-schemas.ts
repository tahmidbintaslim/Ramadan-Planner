// Types shared by the integrations server functions (client-safe: no server imports).
export type IntegrationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface GoogleCalendarStatusDTO {
  connected: boolean;
  email: string | null;
  syncedAt: string | null;
}

/**
 * ICS feed link. `secret`/`urlPath` are only set right after the link is created: the server stores just the
 * secret's hash, so an existing link is reported as `active` without a URL.
 */
export interface IcsLinkDTO {
  secret: string | null;
  urlPath: string | null;
  active: boolean;
}
