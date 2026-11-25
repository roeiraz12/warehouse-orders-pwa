/** Cloud API base URL, e.g. https://<project>.supabase.co/functions/v1/api. Unset = demo mode. */
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || undefined;

/**
 * WhatsApp number that "missing item" messages go to (972… or a local 05… number).
 * Unset = WhatsApp lets the user pick the chat.
 */
export const WHATSAPP_PHONE = toInternational(import.meta.env.VITE_WHATSAPP_PHONE as string | undefined);

/** "052-337…" → "97252337…" (wa.me needs the country code, no leading 0 or +). */
function toInternational(raw?: string): string | undefined {
  const digits = raw?.replace(/\D/g, '');
  if (!digits) return undefined;
  return digits.startsWith('0') ? `972${digits.slice(1)}` : digits;
}

/** How often open screens check for changes from other phones. */
export const POLL_MS = 15_000;

/** Thrown when the business code is missing or wrong (live mode). */
export class AuthError extends Error {}

const CODE_KEY = 'order-manager.business-code';

/** The shared business code, entered once per phone. */
export const businessCode = {
  get(): string | null {
    try {
      return localStorage.getItem(CODE_KEY);
    } catch {
      return null;
    }
  },
  set(code: string) {
    try {
      localStorage.setItem(CODE_KEY, code);
    } catch {
      // Private mode — the code just won't be remembered.
    }
  },
  clear() {
    try {
      localStorage.removeItem(CODE_KEY);
    } catch {
      // ignore
    }
  },
};
