// Demo users. Round 2 uses a one-click role switcher so judges can try every role
// without creating accounts (the organisers require links that open without sign-in).

export type Role = "creator" | "manager" | "compliance" | "admin";

export interface DemoUser {
  id: string;
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
    id: "u_ritika",
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
