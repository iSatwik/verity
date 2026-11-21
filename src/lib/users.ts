// People in the demo workspace. Each one is a real account (email + password, stored as a
// scrypt hash in the accounts table). The sign-in page also offers one-click demo sign-in,
// which goes through the same password check. Turn it off with DEMO_SIGNIN=off.

export type Role = "creator" | "manager" | "compliance" | "admin";

export interface DemoUser {
  id: string;
  email: string;
  name: string;
  initials: string;
  role: Role;
  roleLabel: string;
  team: string;
  color: string;
  canDo: string[];
  /** One plain sentence for the home page. */
  oneLine: string;
}

export const USERS: DemoUser[] = [
  {
    id: "u_rahul",
    email: "rahul@aranya.demo",
    name: "Rahul K.",
    initials: "RK",
    role: "creator",
    roleLabel: "Content creator",
    team: "BrightLeaf agency",
    color: "#e8590c",
    canDo: ["Submit posts, emails, documents and images", "See every issue with the rule it breaks", "Accept fixes and re-check", "Send for approval"],
    oneLine: "Writes posts and fixes the issues Verity finds.",
  },
  {
    id: "u_neha",
    email: "neha@aranya.demo",
    name: "Neha P.",
    initials: "NP",
    role: "creator",
    roleLabel: "Content creator",
    team: "Glow Studio (agency)",
    color: "#c2255c",
    canDo: ["Submit posts for Aranya Naturals", "Sees only her own work, not other agencies'", "Accept fixes and re-check", "Send for approval"],
    oneLine: "Creator at a second agency. Can't see Rahul's work.",
  },
  {
    id: "u_ritika",
    email: "ritika@aranya.demo",
    name: "Ritika S.",
    initials: "RS",
    role: "manager",
    roleLabel: "Brand manager",
    team: "Aranya Naturals",
    color: "#3b5bdb",
    canDo: ["Review submissions", "Comment on any line", "Approve, request changes or approve with exception", "See insights"],
    oneLine: "Reviews every post and gives the final approval.",
  },
  {
    id: "u_arjun",
    email: "arjun@aranya.demo",
    name: "Arjun V.",
    initials: "AV",
    role: "compliance",
    roleLabel: "Compliance reviewer",
    team: "Aranya Naturals",
    color: "#9c36b5",
    canDo: ["Review only content with claims", "Check evidence for each claim", "Approve or request changes"],
    oneLine: "Checks posts that make claims, like results or prices.",
  },
  {
    id: "u_satwik",
    email: "satwik@aranya.demo",
    name: "Satwik",
    initials: "SA",
    role: "admin",
    roleLabel: "Brand admin",
    team: "Aranya Naturals",
    color: "#1b7a5e",
    canDo: ["Edit brand rules, facts and terms", "Import a brand guideline document", "See insights and the audit log"],
    oneLine: "Keeps the brand rules, facts and words up to date.",
  },
];

export function getUser(id: string | undefined | null): DemoUser {
  return USERS.find((u) => u.id === id) ?? USERS[0];
}

export function userName(id: string): string {
  return USERS.find((u) => u.id === id)?.name ?? id;
}

/** Shared password of the demo accounts (shown on the sign-in page). */
export const DEMO_PASSWORD = "aranya-demo";
export const demoSignInEnabled = () => process.env.DEMO_SIGNIN !== "off";
