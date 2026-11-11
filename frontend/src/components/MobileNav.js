
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icons";

const items = [
  { href: "/", label: "Home", icon: "dashboard" },
  { href: "/tutors", label: "Tutors", icon: "book" },
  {
    href: "/dashboard/student",
    label: "Sessions",
    icon: "calendar",
  },
  { href: "/profile", label: "Profile", icon: "user" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className="mobile-safe fixed inset-x-0 bottom-0 z-50 border-t-4 border-[#f5c518] bg-[#26469b] md:hidden"
    >
      <div className="grid h-[68px] grid-cols-4">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/" &&
              pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 text-[10px] font-bold ${
                active
                  ? "text-[#f5c518]"
                  : "text-white/85"
              }`}
            >
              <Icon
                name={item.icon}
                className="h-5 w-5"
              />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
