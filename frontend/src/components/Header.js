
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icons";
import { Logo } from "./Logo";

export function Header() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const pathname = usePathname();

  useEffect(() => {
    let active = true;

    async function loadUser() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        if (!response.ok) {
          if (active) setUser(null);
          return;
        }

        const data = await response.json();

        if (active) {
          setUser(data.user ?? null);
        }
      } catch {
        if (active) setUser(null);
      }
    }

    loadUser();

    return () => {
      active = false;
    };
  }, [pathname]);

  const dashboard =
    user?.role === "tutor"
      ? "/dashboard/tutor"
      : "/dashboard/student";

  const links = [
    { href: "/tutors", label: "Find a tutor" },
    { href: "/#how-it-works", label: "How it works" },
    { href: "/#subjects", label: "Subjects" },
  ];

  async function logout() {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Unable to log out.");
      }

      setUser(null);
      setOpen(false);
      window.location.assign("/");
    } catch (error) {
      console.error("Logout error:", error);
      alert("Unable to log out. Please try again.");
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[#e7eaf1] bg-white/95 backdrop-blur">
      <div className="page-wrap flex h-[72px] items-center justify-between">
        <Logo />

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="nav-link"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <Link
                href={dashboard}
                className="btn-secondary py-2.5"
              >
                Dashboard
              </Link>

              <button
                type="button"
                onClick={logout}
                className="btn-primary py-2.5"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="nav-link px-2"
              >
                Log in
              </Link>

              <Link
                href="/register"
                className="btn-primary py-2.5"
              >
                Get started
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-xl border border-[#e3e7ef] md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle navigation"
          aria-expanded={open}
        >
          <Icon
            name={open ? "close" : "menu"}
            className="h-5 w-5"
          />
        </button>
      </div>

      {open && (
        <div className="border-t border-[#e7eaf1] bg-white p-5 md:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 font-semibold text-[#26334f] hover:bg-[#f5f7fb]"
              >
                {link.label}
              </Link>
            ))}

            <Link
              href={user ? dashboard : "/login"}
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-3 font-semibold text-[#26334f] hover:bg-[#f5f7fb]"
            >
              {user ? "Dashboard" : "Log in"}
            </Link>

            {user ? (
              <button
                type="button"
                onClick={logout}
                className="mt-3 rounded-xl bg-[#26469b] px-4 py-3 text-center font-bold text-white"
              >
                Log out
              </button>
            ) : (
              <Link
                href="/register"
                onClick={() => setOpen(false)}
                className="btn-primary mt-3 text-center"
              >
                Get started
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
