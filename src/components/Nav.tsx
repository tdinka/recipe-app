"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

type IconName = "recipes" | "plan" | "grocery" | "settings";

const links: { href: string; label: string; short: string; icon: IconName }[] = [
  { href: "/recipes", label: "Recipes", short: "Recipes", icon: "recipes" },
  { href: "/meal-plan", label: "Meal Plan", short: "Plan", icon: "plan" },
  { href: "/grocery-list", label: "Grocery List", short: "Groceries", icon: "grocery" },
  { href: "/settings", label: "Settings", short: "Settings", icon: "settings" },
];

function Icon({ name }: { name: IconName }) {
  const props = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "recipes") {
    return (
      <svg {...props}>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    );
  }
  if (name === "plan") {
    return (
      <svg {...props}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    );
  }
  if (name === "grocery") {
    return (
      <svg {...props}>
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

export function Nav() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  if (pathname === "/login" || pathname === "/register") return null;
  // The family's shared grocery list link is a full-screen, no-login page.
  if (pathname?.startsWith("/list/")) return null;

  const signedIn = status === "authenticated";

  return (
    <>
      <header className="border-b border-linen-300 bg-linen-100/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/recipes"
            className="shrink-0 whitespace-nowrap font-display text-xl italic text-brick"
          >
            The Recipe Box
          </Link>

          {signedIn && (
            <nav className="flex items-center gap-1 md:gap-2">
              {/* Full links on iPad/desktop; phones use the bottom tab bar */}
              <div className="hidden items-center gap-2 md:flex">
                {links.map((link) => {
                  const active = pathname?.startsWith(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`whitespace-nowrap rounded-card px-3 py-1.5 text-sm font-medium transition-colors ${
                        active ? "bg-forest text-linen-50" : "text-ink-light hover:bg-linen-200"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
              <Link
                href="/recipes/new"
                className="btn-primary whitespace-nowrap !px-3 !py-1.5 text-xs"
              >
                + Add<span className="hidden md:inline">&nbsp;a recipe</span>
              </Link>
              <span className="mx-2 hidden text-xs text-ink-light lg:inline">
                {session.user.householdName}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="btn-ghost whitespace-nowrap !px-3 !py-1.5 text-xs"
              >
                Sign out
              </button>
            </nav>
          )}
        </div>
      </header>

      {signedIn && (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-linen-300 bg-linen-50/95 backdrop-blur md:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="grid grid-cols-4">
            {links.map((link) => {
              const active = pathname?.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                    active ? "text-forest" : "text-ink-light"
                  }`}
                >
                  <Icon name={link.icon} />
                  {link.short}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
