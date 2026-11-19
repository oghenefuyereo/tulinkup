
// Import Link to navigate between dashboard pages.
import Link from "next/link";

// Import the icons used in the dashboard navigation.
import { Icon } from "./Icons";

// Import the mobile navigation component.
import { MobileNav } from "./MobileNav";

// Create a reusable dashboard layout for students and tutors.
export function DashboardShell({
  role,
  name,
  children,
}) {
  // Choose the navigation links based on the user's role.
  const items =
    role === "student"
      ? [
          // Navigation options for student accounts.
          [
            "dashboard",
            "Overview",
            "/dashboard/student",
          ],

          // Browse available tutors.
          [
            "search",
            "Browse tutors",
            "/tutors",
          ],

          // Browse available group live classes.
          [
            "calendar",
            "Browse group classes",
            "/group-classes",
          ],

          // View and manage enrolled group classes.
          [
            "book",
            "My group classes",
            "/dashboard/student/group-classes",
          ],

          // Manage the student's personal profile.
          [
            "user",
            "My profile",
            "/profile",
          ],
        ]
      : [
          // Navigation options for tutor accounts.
          [
            "dashboard",
            "Overview",
            "/dashboard/tutor",
          ],

          // Manage the tutor's professional profile.
          [
            "user",
            "Manage profile",
            "/profile",
          ],

          // Manage tutoring availability.
          [
            "calendar",
            "Availability",
            "/availability",
          ],

          // Create and manage group live classes.
          [
            "book",
            "Group Live Classes",
            "/dashboard/tutor/group-classes",
          ],
        ];

  // Display the dashboard layout and navigation.
  return (
    <>
      {/* Main container for the dashboard pages. */}
      {/* Add bottom padding to prevent mobile navigation
          from covering dashboard content. */}
      <div className="min-h-screen bg-[#f7f9fd] pb-24 lg:pb-0">
        <div className="page-wrap grid gap-8 py-8 lg:grid-cols-[230px_1fr]">
          {/* Display the sidebar navigation on larger screens. */}
          <aside className="hidden lg:block">
            <div className="panel sticky top-24 p-4">
              {/* Display the user's account role and name. */}
              <div className="border-b border-[#edf0f5] px-3 pb-5">
                <p className="text-xs font-bold uppercase tracking-wider text-[#8190a8]">
                  {role} account
                </p>

                <p className="mt-1 break-words font-extrabold">
                  {name}
                </p>
              </div>

              {/* Display navigation links for the user's dashboard. */}
              <nav
                aria-label={`${role} dashboard navigation`}
                className="mt-4 space-y-1"
              >
                {/* Create a navigation link for each menu item. */}
                {items.map(([icon, label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-[#5a6780] transition-colors hover:bg-[#edf1fa] hover:text-[#173472]"
                  >
                    {/* Display the icon associated with the menu item. */}
                    <Icon
                      name={icon}
                      className="h-5 w-5 shrink-0"
                    />

                    {/* Display the navigation link name. */}
                    <span>{label}</span>
                  </Link>
                ))}
              </nav>
            </div>
          </aside>

          {/* Display the content of the selected dashboard page. */}
          <div className="min-w-0">
            {children}
          </div>
        </div>
      </div>

      {/* Display role-based navigation for mobile devices. */}
      <MobileNav role={role} />
    </>
  );
}
