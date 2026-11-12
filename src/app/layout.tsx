import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import "./globals.css";
import { currentUser, hasChosenRole } from "@/lib/session";
import { USERS } from "@/lib/users";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { NavLinks } from "@/components/NavLinks";

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
        <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
            <Link href="/" className="flex items-center gap-2 text-[21px] font-bold tracking-tight">
              <span>verity<span className="text-brand-500">.</span></span>
            </Link>
            <span className="hidden rounded-md border border-gray-200 px-2 py-0.5 text-xs text-gray-500 md:inline">
              Workspace: <b className="text-gray-700">Aranya Naturals</b> (demo)
            </span>
            <NavLinks role={user.role} />
            <div className="ml-auto">
              <RoleSwitcher users={USERS} currentId={user.id} highlight={!chosen} />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-7xl px-4 pb-8 pt-4 text-xs text-gray-400">
          Verity · Team Knox · CodeNova India 2026 (Round 2). Aranya Naturals is a fictional brand used for the demo. <Link href="/about" className="underline">How it works</Link>
        </footer>
      </body>
    </html>
  );
}
