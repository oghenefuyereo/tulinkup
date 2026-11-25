
// Enable client-side interactions in this component.
"use client";

// Import React hooks to manage state and load user information.
import { useEffect, useState } from "react";

// Import Link for navigation between pages.
import Link from "next/link";

// Import usePathname to detect changes in the current page.
import { usePathname } from "next/navigation";
import { isPlatformRoute } from "@/lib/platformRoutes";

// Import the icons and logo used in the header.
import { Icon } from "./Icons";
import { Logo } from "./Logo";

// Create the main navigation header for TuLinkUp.
export function Header() {
  // Track whether the mobile navigation menu is open.
  const [open, setOpen] = useState(false);

  // Store information about the currently logged-in user.
  const [user, setUser] = useState(null);

  // Get the current page path.
  const pathname = usePathname();

  // Check the user's login status when the page path changes.
  useEffect(() => {
    // Track whether this effect is still active.
    let active = true;

    // Retrieve the currently authenticated user.
    async function loadUser() {
      try {
        // Request the user's information from the authentication API.
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        // Clear user information if the request is unsuccessful.
        if (!response.ok) {
          if (active) setUser(null);
          return;
        }

        // Read the user information returned by the API.
        const data = await response.json();

        // Update the user state if the component is still active.
        if (active) {
          setUser(data.user ?? null);
        }
      } catch {
        // Clear user information if the request fails.
        if (active) setUser(null);
      }
    }

    // Check the user's authentication status.
    loadUser();

    // Prevent outdated requests from updating the user state.
    return () => {
      active = false;
    };
  }, [pathname]);

  // Send each user to the dashboard for their account role.
  const dashboards = {
    admin: "/dashboard/admin",
    student: "/dashboard/student",
    tutor: "/dashboard/tutor",
  };

  const dashboard =
    typeof user?.role === "string" &&
    Object.hasOwn(dashboards, user.role)
      ? dashboards[user.role]
      : "/login";

  // Define the main navigation links.
  const links = [
    // Browse available tutors.
    { href: "/tutors", label: "Find a tutor" },

    // Browse available group live classes.
    { href: "/group-classes", label: "Group Classes" },

    // Courses are currently under development.
    { href: "/courses", label: "Courses" },

    // Learn how TuLinkUp works.
    { href: "/#how-it-works", label: "How it works" },


  ];

  // Check whether a navigation link is currently active.
  function isActiveLink(href) {
    // Do not highlight homepage section links based on pathname.
    if (href.includes("#")) {
      return false;
    }

    return (
      pathname === href ||
      pathname.startsWith(`${href}/`)
    );
  }

  // Handle logging the user out of TuLinkUp.
  async function logout() {
    try {
      // Send a logout request to the authentication API.
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      // Check whether the logout request was successful.
      if (!response.ok) {
        throw new Error("Unable to log out.");
      }

      // Clear the user's information and close the mobile menu.
      setUser(null);
      setOpen(false);

      // Redirect the user to the homepage after logging out.
      window.location.assign("/");
    } catch (error) {
      // Display an error if the logout request fails.
      console.error("Logout error:", error);
      alert("Unable to log out. Please try again.");
    }
  }

  // Use the shared header across platform and dashboard pages.
  const isDashboardRoute =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/");

  if (isPlatformRoute(pathname) || isDashboardRoute) {
    return (
      <header
        aria-label="TuLinkUp platform header"
        className="sticky top-0 z-50 border-b border-[#e7eaf1] bg-white/95 backdrop-blur"
      >
        <div className="mx-auto flex min-h-[72px] max-w-[1440px] flex-wrap items-center justify-between gap-2 px-3 py-3 sm:flex-nowrap sm:gap-5 sm:px-6">
          <Logo />

          {/* Search tutors by name, subject, or expertise. */}
          <form
            action="/tutors"
            method="GET"
            role="search"
            className="order-last flex h-11 w-full items-center gap-2 rounded-xl border border-[#e3e7ef] bg-[#f7f9fd] px-3 focus-within:border-[#26469b] sm:order-none sm:min-w-0 sm:max-w-md sm:flex-1"
          >
            <input
              type="search"
              name="q"
              aria-label="Search tutors by name or subject"
              placeholder="Find a tutor"
              maxLength={200}
              className="min-w-0 flex-1 bg-transparent text-sm text-[#17233d] outline-none placeholder:text-[#68758c]"
            />

            <button
              type="submit"
              aria-label="Search tutors"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#26469b] transition hover:bg-[#e5e9f0]"
            >
              <Icon name="search" className="h-5 w-5" />
            </button>
          </form>

          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            {/* Notifications will be enabled in a future update. */}
            <button
              type="button"
              disabled
              title="Notifications coming soon"
              aria-label="Notifications coming soon"
              className="grid h-8 w-8 cursor-not-allowed place-items-center text-[#68758c] sm:h-10 sm:w-10"
            >
              <Icon name="bell" className="h-5 w-5" />
            </button>

            {/* Messaging will be implemented in Step 199. */}
            <button
              type="button"
              disabled
              title="Messages coming soon"
              aria-label="Messages coming soon"
              className="grid h-8 w-8 cursor-not-allowed place-items-center text-[#68758c] sm:h-10 sm:w-10"
            >
              <Icon name="message" className="h-5 w-5" />
            </button>

            <Link
              href={user ? "/profile" : "/login"}
              aria-label={user ? "My profile" : "Log in"}
              className="hidden h-10 w-10 place-items-center rounded-full bg-[#f0f3f9] text-[#173472] lg:grid"
            >
              <Icon name="user" className="h-5 w-5" />
            </Link>

            {/* Preserve account and dashboard access. */}
            <button
              type="button"
              aria-label="Toggle account menu"
              aria-expanded={open}
              aria-controls="feed-account-menu"
              onClick={() => setOpen((previous) => !previous)}
              className="grid h-8 w-8 place-items-center rounded-xl text-[#173472] sm:h-10 sm:w-10"
            >
              <Icon
                name={open ? "close" : "menu"}
                className="h-5 w-5"
              />
            </button>
          </div>
        </div>

        {open && (
          <nav
            id="feed-account-menu"
            aria-label="Feed account navigation"
            className="absolute right-3 top-full mt-2 flex w-64 flex-col gap-2 rounded-2xl border border-[#e3e7ef] bg-white p-4 shadow-lg sm:right-6"
          >
            {user ? (
              <>
                <Link
                  href={dashboard}
                  onClick={() => setOpen(false)}
                  className="btn-secondary"
                >
                  Dashboard
                </Link>

                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="btn-secondary"
                >
                  My profile
                </Link>

                <button
                  type="button"
                  onClick={logout}
                  className="btn-primary"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="btn-secondary"
                >
                  Log in
                </Link>

                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className="btn-primary"
                >
                  Get started
                </Link>
              </>
            )}

            <Link
              href="/tutors"
              onClick={() => setOpen(false)}
              className="nav-link px-3 py-2"
            >
              Find a tutor
            </Link>

            <Link
              href="/group-classes"
              onClick={() => setOpen(false)}
              className="nav-link px-3 py-2"
            >
              Group classes
            </Link>

            <Link
              href="/courses"
              onClick={() => setOpen(false)}
              className="nav-link px-3 py-2"
            >
              Courses
            </Link>
          </nav>
        )}
      </header>
    );
  }

  // Display the main website header.
  return (
    <header className="sticky top-0 z-50 border-b border-[#e7eaf1] bg-white/95 backdrop-blur">
      {/* Organize the logo, navigation links, and account buttons. */}
      <div className="page-wrap flex h-[72px] items-center justify-between gap-4">
        {/* Display the TuLinkUp logo. */}
        <Logo />

        {/* Display the main navigation links on larger screens. */}
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-4 lg:flex xl:gap-8"
        >
          {links.map((link) => {
            // Determine whether the current link is active.
            const active = isActiveLink(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={
                  pathname === link.href
                    ? "page"
                    : undefined
                }
                className={`nav-link whitespace-nowrap ${
                  active
                    ? "!font-bold !text-[#26469b]"
                    : ""
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Display account-related buttons on larger screens. */}
        <div className="hidden shrink-0 items-center gap-3 lg:flex">
          {/* Show dashboard and logout buttons for logged-in users. */}
          {user ? (
            <>
              {/* Navigate to the user's dashboard. */}
              <Link
                href={dashboard}
                className="btn-secondary py-2.5"
              >
                Dashboard
              </Link>

              {/* Allow the user to log out. */}
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
              {/* Display login and registration links for visitors. */}
              <Link
                href="/login"
                className="nav-link whitespace-nowrap px-2"
              >
                Log in
              </Link>

              <Link
                href="/register"
                className="btn-primary whitespace-nowrap py-2.5"
              >
                Get started
              </Link>
            </>
          )}
        </div>

        {/* Allow mobile users to open or close the navigation menu. */}
        <button
          type="button"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#e3e7ef] lg:hidden"
          onClick={() => setOpen((previous) => !previous)}
          aria-label="Toggle navigation"
          aria-expanded={open}
          aria-controls="mobile-header-navigation"
        >
          {/* Change the icon depending on whether the menu is open. */}
          <Icon
            name={open ? "close" : "menu"}
            className="h-5 w-5"
          />
        </button>
      </div>

      {/* Display the mobile navigation menu when it is open. */}
      {open && (
        <div
          id="mobile-header-navigation"
          className="border-t border-[#e7eaf1] bg-white p-5 lg:hidden"
        >
          <nav
            aria-label="Mobile header navigation"
            className="flex flex-col gap-1"
          >
            {/* Display the main navigation links on mobile devices. */}
            {links.map((link) => {
              // Determine whether the current link is active.
              const active = isActiveLink(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={
                    pathname === link.href
                      ? "page"
                      : undefined
                  }
                  className={`rounded-xl px-4 py-3 font-semibold ${
                    active
                      ? "bg-[#edf1fa] text-[#26469b]"
                      : "text-[#26334f] hover:bg-[#f5f7fb]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}

            {/* Show the dashboard link or login link based on authentication. */}
            <Link
              href={user ? dashboard : "/login"}
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-3 font-semibold text-[#26334f] hover:bg-[#f5f7fb]"
            >
              {user ? "Dashboard" : "Log in"}
            </Link>

            {/* Provide quick access to group class management. */}
            {user?.role === "student" && (
              <Link
                href="/dashboard/student/group-classes"
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 font-semibold text-[#26334f] hover:bg-[#f5f7fb]"
              >
                My Group Classes
              </Link>
            )}

            {user?.role === "tutor" && (
              <Link
                href="/dashboard/tutor/group-classes"
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 font-semibold text-[#26334f] hover:bg-[#f5f7fb]"
              >
                Manage Group Classes
              </Link>
            )}

            {/* Show logout for logged-in users or registration for visitors. */}
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
