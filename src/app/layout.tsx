import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import "./globals.css";
import { currentUser, hasChosenRole } from "@/lib/session";
import { USERS } from "@/lib/users";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { NavLinks } from "@/components/NavLinks";
import { RoleGate } from "@/components/RoleGate";

const inter = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Verity: brand checks before you publish",
  description: "Check posts, emails, documents and images against approved brand rules and facts. Every issue cites its source, comes with a fix, and a human approves.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const chosen = await hasChosenRole();
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">
        <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center gap-8 px-5">
            <Link href="/" className="py-3 text-[18px] font-semibold tracking-tight text-gray-900">verity</Link>
            {chosen && <NavLinks role={user.role} />}
            {chosen && <div className="ml-auto"><RoleSwitcher users={USERS} currentId={user.id} highlight={false} /></div>}
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8">{chosen ? children : <RoleGate users={USERS} />}</main>
        <footer className="mx-auto max-w-6xl px-5 pb-10 pt-2 text-[12px] text-gray-400">
          Verity by Team Knox · <Link href="/about" className="hover:text-gray-600">How it works</Link>
        </footer>
      </body>
    </html>
  );
}
