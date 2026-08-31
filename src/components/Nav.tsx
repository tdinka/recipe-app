"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

const links = [
  { href: "/recipes", label: "Recipes" },
  { href: "/meal-plan", label: "Meal Plan" },
  { href: "/grocery-list", label: "Grocery List" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  if (pathname === "/login" || pathname === "/register") return null;

  return (
    <header className="border-b border-linen-300 bg-linen-100/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/recipes" className="font-display text-xl italic text-brick">
          The Recipe Box
        </Link>

        {status === "authenticated" && (
          <nav className="flex items-center gap-1 sm:gap-2">
            {links.map((link) => {
              const active = pathname?.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-card px-3 py-1.5 text-sm font-medium transition-colors ${
                    active ? "bg-forest text-linen-50" : "text-ink-light hover:bg-linen-200"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <span className="mx-2 hidden text-xs text-ink-light sm:inline">
              {session.user.householdName}
            </span>
            <button onClick={() => signOut({ callbackUrl: "/login" })} className="btn-ghost !px-3 !py-1.5 text-xs">
              Sign out
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}
