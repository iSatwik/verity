import "server-only";
import { cookies } from "next/headers";
import { USERS, type DemoUser } from "./users";
import { verifySession } from "./auth";

export const SESSION_COOKIE = "verity_session";

/** The signed-in person, or null. The cookie is HMAC-signed, so it can't be edited to change role. */
export async function sessionUser(): Promise<DemoUser | null> {
  const c = await cookies();
  const claims = verifySession(c.get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const u = USERS.find((x) => x.id === claims.uid);
  return u && u.role === claims.role ? u : null;
}

/** For pages (the layout shows the sign-in screen when nobody is signed in). */
export async function currentUser(): Promise<DemoUser> {
  return (await sessionUser()) ?? USERS[0];
}

/** For actions: refuses to run without a valid session. */
export async function requireUser(): Promise<DemoUser> {
  const u = await sessionUser();
  if (!u) throw new Error("Your session has ended. Please sign in again.");
  return u;
}

export async function hasChosenRole(): Promise<boolean> {
  return (await sessionUser()) !== null;
}
