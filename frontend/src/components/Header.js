
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

  // Choose the correct dashboard based on the user's role.
  const dashboard =
    user?.role === "tutor"
      ? "/dashboard/tutor"
      : "/dashboard/student";

  // Define the main navigation links.
  const links = [
    { href: "/tutors", label: "Find a tutor" },
    { href: "/#how-it-works", label: "How it works" },
    { href: "/#subjects", label: "Subjects" },
  ];

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
      <div className="page-wrap flex h-[72px] items-center justify-between">
        {/* Display the TuLinkUp logo. */}
        <Logo />

        {/* Display the main navigation links on larger screens. */}
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

        {/* Display account-related buttons on larger screens. */}
        <div className="hidden items-center gap-3 md:flex">
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

        {/* Allow mobile users to open or close the navigation menu. */}
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-xl border border-[#e3e7ef] md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle navigation"
          aria-expanded={open}
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
        <div className="border-t border-[#e7eaf1] bg-white p-5 md:hidden">
          <nav className="flex flex-col gap-1">
            {/* Display the main navigation links on mobile devices. */}
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

            {/* Show the dashboard link or login link based on authentication. */}
            <Link
              href={user ? dashboard : "/login"}
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-3 font-semibold text-[#26334f] hover:bg-[#f5f7fb]"
            >
              {user ? "Dashboard" : "Log in"}
            </Link>

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
