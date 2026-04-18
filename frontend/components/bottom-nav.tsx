"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HistoryIcon, HomeIcon, ProfileIcon } from "./icons";

const items = [
  { href: "/home", label: "Home", Icon: HomeIcon },
  { href: "/history", label: "Aktivitas", Icon: HistoryIcon },
  { href: "/profile", label: "Akun", Icon: ProfileIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="sticky bottom-0 z-40 mt-auto px-4 pb-[max(env(safe-area-inset-bottom),10px)] pt-3"
    >
      <div
        className="flex items-center justify-around rounded-[28px] bg-white px-2 py-2"
        style={{ boxShadow: "0 -8px 28px -14px rgba(13, 78, 168, 0.25)" }}
      >
        {items.map(({ href, label, Icon }) => {
          const active =
            pathname === href ||
            (href === "/home" && pathname === "/home") ||
            (href !== "/home" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="group relative flex flex-col items-center gap-0.5 px-5 py-1.5"
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                  active
                    ? "bg-[color:var(--color-primary)] text-white"
                    : "text-[color:var(--color-ink-2)] group-hover:text-[color:var(--color-primary)]"
                }`}
              >
                <Icon size={20} />
              </span>
              <span
                className={`text-[10px] font-semibold tracking-wide ${
                  active ? "text-[color:var(--color-primary)]" : "text-[color:var(--color-ink-3)]"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
