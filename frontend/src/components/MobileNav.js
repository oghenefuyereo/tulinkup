
// Enable client-side interactions in this component.
"use client";

// Import Link to navigate between pages.
import Link from "next/link";

// Import usePathname to identify the current page.
import { usePathname } from "next/navigation";

// Import the reusable icons used in the navigation.
import { Icon } from "./Icons";

// Define the navigation items displayed on mobile devices.
const items = [
  // Link to the TuLinkUp homepage.
  { href: "/", label: "Home", icon: "dashboard" },

  // Link to the tutor discovery page.
  { href: "/tutors", label: "Tutors", icon: "book" },

  // Link to the student dashboard for managing sessions.
  {
    href: "/dashboard/student",
    label: "Sessions",
    icon: "calendar",
  },

  // Link to the user's profile page.
  { href: "/profile", label: "Profile", icon: "user" },
];

// Create the bottom navigation bar for mobile users.
export function MobileNav() {
  // Get the current page path.
  const pathname = usePathname();

  // Display the mobile navigation bar.
  return (
    <nav
      // Provide an accessible name for the navigation.
      aria-label="Mobile navigation"

      // Keep the navigation fixed at the bottom of smaller screens.
      className="mobile-safe fixed inset-x-0 bottom-0 z-50 border-t-4 border-[#f5c518] bg-[#26469b] md:hidden"
    >
      {/* Arrange the navigation items into four equal columns. */}
      <div className="grid h-[68px] grid-cols-4">
        {/* Create a navigation link for each item. */}
        {items.map((item) => {
          // Check whether this item matches the current page.
          const active =
            pathname === item.href ||
            (item.href !== "/" &&
              pathname.startsWith(item.href));

          return (
            <Link
              // Use the page URL as a unique key.
              key={item.href}

              // Set the destination of the navigation link.
              href={item.href}

              // Identify the active page for accessibility.
              aria-current={active ? "page" : undefined}

              // Highlight the active link in yellow.
              className={`flex flex-col items-center justify-center gap-1 text-[10px] font-bold ${
                active
                  ? "text-[#f5c518]"
                  : "text-white/85"
              }`}
            >
              {/* Display the icon associated with the navigation item. */}
              <Icon
                name={item.icon}
                className="h-5 w-5"
              />

              {/* Display the navigation label. */}
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
