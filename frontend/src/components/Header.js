
// Enable client-side interactions in this component.
"use client";

// Import React hooks to manage state and load user information.
import { useEffect, useState } from "react";

// Import Link for navigation between pages.
import Link from "next/link";

// Import usePathname to detect changes in the current page.
import { usePathname } from "next/navigation";

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

    // Learn how TuLinkUp works.
    { href: "/#how-it-works", label: "How it works" },

    // Explore available subjects.
    { href: "/#subjects", label: "Subjects" },
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
