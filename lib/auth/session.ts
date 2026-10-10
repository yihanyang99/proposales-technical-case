import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// One shared password in front of the whole app (see proxy.ts and app/login). The app spends money
// (OpenAI) and writes to Proposales drafts, so a deployment must not be open to anyone with the
// link. A signed cookie keeps the salesperson or reviewer signed in; no user accounts.

export const SESSION_COOKIE = "rc_session";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** The shared password from APP_PASSWORD; null when none is set. */
export function authSecret(env: Record<string, string | undefined>): string | null {
  return env.APP_PASSWORD?.trim() || null;
}

/** Compares in constant time, so the response time reveals nothing about the password. */
export function passwordMatches(input: string, password: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(input), digest(password));
}

function sign(expires: number, secret: string): string {
  // Derived from the password, so changing APP_PASSWORD signs everyone out.
  return createHmac("sha256", secret).update(`revenue-copilot-session:${expires}`).digest("base64url");
}

/** `<expiry in seconds>.<signature>`, valid for SESSION_TTL_SECONDS. */
export function createSessionToken(secret: string, nowMs: number): string {
  const expires = Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS;
  return `${expires}.${sign(expires, secret)}`;
}

export function isValidSessionToken(token: string | undefined, secret: string, nowMs: number): boolean {
  const match = /^(\d{1,12})\.([A-Za-z0-9_-]{43})$/.exec(token ?? "");
  if (!match) return false;
  const expires = Number(match[1]);
  if (expires * 1000 <= nowMs) return false;
  const expected = Buffer.from(sign(expires, secret));
  const actual = Buffer.from(match[2]);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Where to go after signing in: only a path inside this app, never another site. */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (value === "/login" || value.startsWith("/login?")) return "/";
  return value;
}
