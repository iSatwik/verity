// Passwords and signed session tokens. No external auth service: scrypt for passwords,
// HMAC-SHA256 for the session cookie. Works the same on Vercel and on a company server.
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(pw: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [kind, saltHex, hashHex] = stored.split("$");
  if (kind !== "scrypt" || !saltHex || !hashHex) return false;
  const want = Buffer.from(hashHex, "hex");
  const got = scryptSync(pw, Buffer.from(saltHex, "hex"), want.length, { N: 16384, r: 8, p: 1 });
  return got.length === want.length && timingSafeEqual(got, want);
}

function secret(): Buffer {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return Buffer.from(s);
  // Fallback for the demo: derived from the database address, which is itself secret.
  return createHash("sha256").update("verity-session:" + (process.env.DATABASE_URL ?? "local-dev")).digest();
}

export interface SessionClaims { uid: string; role: string; exp: number }

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function signSession(uid: string, role: string, days = 7): string {
  const claims: SessionClaims = { uid, role, exp: Math.floor(Date.now() / 1000) + days * 86400 };
  const body = b64(JSON.stringify(claims));
  const sig = b64(createHmac("sha256", secret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifySession(token: string | undefined | null): SessionClaims | null {
  if (!token || token.length > 1000) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const want = createHmac("sha256", secret()).update(body).digest();
  const got = Buffer.from(sig, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const c = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionClaims;
    if (typeof c.uid !== "string" || typeof c.role !== "string" || typeof c.exp !== "number") return null;
    if (c.exp < Date.now() / 1000) return null;
    return c;
  } catch {
    return null;
  }
}

// Simple lock-out: 5 wrong passwords for one email within 10 minutes blocks that email for 10 minutes.
const fails = new Map<string, number[]>();
export function lockedOut(email: string): boolean {
  const now = Date.now();
  const list = (fails.get(email) ?? []).filter((t) => now - t < 10 * 60_000);
  fails.set(email, list);
  return list.length >= 5;
}
export function noteFailure(email: string) {
  fails.set(email, [...(fails.get(email) ?? []), Date.now()]);
}
export function clearFailures(email: string) {
  fails.delete(email);
}
