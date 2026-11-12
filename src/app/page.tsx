import { USERS } from "@/lib/users";
import { currentUser, hasChosenRole } from "@/lib/session";
import { q } from "@/lib/db";
import { Landing } from "@/components/Landing";

export default async function Home() {
  const me = await currentUser();
  const chosen = await hasChosenRole();
  const demo = await q<{ id: number }>("SELECT id FROM submissions WHERE title = 'Neem cleanser launch post' ORDER BY id LIMIT 1");
  return <Landing users={USERS} currentId={chosen ? me.id : null} demoId={demo[0]?.id} />;
}
