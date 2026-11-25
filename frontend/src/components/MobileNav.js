
// Enable client-side interactions in this component.
"use client";

// Import Link to navigate between pages.
import Link from "next/link";

// Import usePathname to identify the current page.
import { usePathname } from "next/navigation";
import { isPlatformRoute } from "@/lib/platformRoutes";

// Import the reusable icons used in the navigation.
import { Icon } from "./Icons";

// Create the bottom navigation bar for mobile users.
export function MobileNav({ role }) {
  // Get the current page path.
  const pathname = usePathname();

  // Determine whether the current user is a tutor.
  const isTutor = role === "tutor";

  // Choose the appropriate dashboard based on the user's role.
  const dashboard = isTutor
    ? "/dashboard/tutor"
    : "/dashboard/student";

  // Choose the appropriate group classes dashboard.
  const groupClassesDashboard = isTutor
    ? "/dashboard/tutor/group-classes"
    : "/dashboard/student/group-classes";

  // Define the navigation items displayed on mobile devices.
  const dashboardItems = [
    // Link to the TuLinkUp homepage.
    {
      href: "/",
      label: "Home",
      icon: "dashboard",
    },

    // Link to the tutor discovery page.
    {
      href: "/tutors",
      label: "Tutors",
      icon: "book",
    },

    // Link to the public group classes marketplace.
    {
      href: "/group-classes",
      label: "Classes",
      icon: "calendar",
    },

    // Link to the appropriate dashboard for managing sessions.
    {
      href: dashboard,
      label: "Sessions",
      icon: "calendar",
    },

    // Allow students and tutors to manage their group classes.
    {
      href: groupClassesDashboard,
      label: isTutor ? "Manage" : "My Classes",
      icon: "book",
    },

    // Link to the user's profile page.
    {
      href: "/profile",
      label: "Profile",
      icon: "user",
    },
  ];

  const feedItems = [
    { href: "/", label: "Home", icon: "home" },
    { href: "/tutors", label: "Explore", icon: "search" },
    { href: "/group-classes", label: "Classes", icon: "calendar" },
    { href: "/courses", label: "Courses", icon: "courses" },
    { href: "/profile", label: "Profile", icon: "user" },
  ];

  const isFeedPage = isPlatformRoute(pathname);

  const items = isFeedPage
    ? feedItems
    : dashboardItems;

  // Find the most specific navigation item matching the current page.
  // This prevents multiple navigation items from being highlighted.
  const activeItem = items
    .filter(
      (item) =>
        pathname === item.href ||
        (item.href !== "/" &&
          pathname.startsWith(`${item.href}/`))
    )
    .sort((a, b) => b.href.length - a.href.length)[0];

  // Display the mobile navigation bar.
  return (
    <nav
      // Provide an accessible name for the navigation.
      aria-label="Mobile navigation"

      // Keep the navigation fixed at the bottom of smaller screens.
      className="mobile-safe fixed inset-x-0 bottom-0 z-50 border-t-4 border-[#f5c518] bg-[#26469b] lg:hidden"
    >
      {/* Arrange the navigation items into six equal columns. */}
      <div className={`grid h-[68px] ${isFeedPage ? "grid-cols-5" : "grid-cols-6"}`}>
        {/* Create a navigation link for each item. */}
        {items.map((item) => {
          // Check whether this item matches the current page.
          const active = activeItem?.href === item.href;

          return (
            <Link
              // Use the page URL as a unique key.
              key={item.href}

              // Set the destination of the navigation link.
              href={item.href}

              // Identify the active page for accessibility.
              aria-current={
                pathname === item.href
                  ? "page"
                  : active
                    ? "location"
                    : undefined
              }

              // Highlight the active link in yellow.
              className={`flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-center text-[10px] font-bold transition-colors hover:text-[#f5c518] ${
                active
                  ? "text-[#f5c518]"
                  : "text-white/85"
              }`}
            >
              {/* Display the icon associated with the navigation item. */}
              <Icon
                name={item.icon}
                className="h-5 w-5 shrink-0"
              />

              {/* Display the navigation label. */}
              <span className="leading-tight">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
