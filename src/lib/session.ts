import "server-only";
import { cookies } from "next/headers";
import { getUser, type DemoUser } from "./users";

export const ROLE_COOKIE = "verity_user";

export async function currentUser(): Promise<DemoUser> {
  const c = await cookies();
  return getUser(c.get(ROLE_COOKIE)?.value);
}

export async function hasChosenRole(): Promise<boolean> {
  const c = await cookies();
  return Boolean(c.get(ROLE_COOKIE)?.value);
}
