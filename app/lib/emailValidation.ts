/**
 * Disposable-email screening for signup.
 *
 * A free tier that burns real Groq credits is a magnet for throwaway-address
 * abuse: sign up, exhaust the free quota, discard, repeat. Blocking the common
 * disposable domains raises that cost without a CAPTCHA. It's deliberately a
 * curated blocklist, not an exhaustive one — the goal is to stop casual abuse,
 * not to win an arms race. Pair it with the per-IP signup rate limit.
 *
 * Pure module (no server-only import) so it's unit-testable in isolation.
 */

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.info", "grr.la",
  "10minutemail.com", "10minutemail.net", "tempmail.com", "temp-mail.org",
  "throwawaymail.com", "yopmail.com", "getnada.com", "nada.email",
  "dispostable.com", "trashmail.com", "trash-mail.com", "sharklasers.com",
  "maildrop.cc", "mailnesia.com", "mohmal.com", "fakeinbox.com",
  "tempinbox.com", "emailondeck.com", "mintemail.com", "spamgourmet.com",
  "mytemp.email", "moakt.com", "tmpmail.org", "tmpeml.com", "burnermail.io",
  "1secmail.com", "1secmail.org", "inboxkitten.com", "tempmailo.com",
  "discard.email", "mailcatch.com", "spam4.me", "instantemail.com",
]);

/** The domain part of an email, lowercased. Null if it doesn't parse. */
export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at === -1 || at === email.length - 1) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

export function isDisposableEmail(email: string): boolean {
  const domain = emailDomain(email);
  return domain !== null && DISPOSABLE_DOMAINS.has(domain);
}
