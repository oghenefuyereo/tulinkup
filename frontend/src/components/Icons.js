
// Create a reusable component for displaying icons throughout TuLinkUp.
export function Icon({ name, ...props }) {
  // Store the SVG shapes for each available icon.
  const paths = {
    // Search icon used for finding tutors.
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),

    // User icon used for profiles and account navigation.
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c.8-5 3.5-7 8-7s7.2 2 8 7" />
      </>
    ),

    // Calendar icon used for bookings and tutor availability.
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4m8-4v4M3 10h18" />
      </>
    ),

    // Dashboard icon used for the account overview.
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),

    // Book icon used for learning and educational content.
    book: (
      <>
        <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H12v18H7.5A3.5 3.5 0 0 0 4 23.5z" />
        <path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H12v18h4.5a3.5 3.5 0 0 1 3.5 3.5z" />
      </>
    ),

    // Star icon used for ratings and reviews.
    star: (
      <path d="m12 2 3 6 6.5 1-4.7 4.7 1.1 6.6L12 17.2l-5.9 3.1 1.1-6.6L2.5 9 9 8z" />
    ),

    // Check icon used for successful actions and confirmations.
    check: (
      <path d="m5 12 4 4L19 6" />
    ),

    // Arrow icon used for navigation and action buttons.
    arrow: (
      <path d="M5 12h14m-5-5 5 5-5 5" />
    ),

    // Location icon used to display geographical information.
    location: (
      <>
        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),

    // Menu icon used to open the mobile navigation.
    menu: (
      <path d="M4 7h16M4 12h16M4 17h16" />
    ),

    // Close icon used to close the mobile navigation.
    close: (
      <path d="m6 6 12 12M18 6 6 18" />
    ),

    // Clock icon used to represent time and session duration.
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),

    // Chart icon used for statistics and progress information.
    chart: (
      <>
        <path d="M4 20V10m6 10V4m6 16v-7m4 7H2" />
      </>
    ),
  };

  // Display the SVG icon requested by another component.
  return (
    <svg
      // Set the coordinate system for all icons.
      viewBox="0 0 24 24"

      // Keep the icon transparent inside.
      fill="none"

      // Use the current text colour for the icon outline.
      stroke="currentColor"

      // Set the thickness of the icon lines.
      strokeWidth="1.8"

      // Give the lines rounded ends and corners.
      strokeLinecap="round"
      strokeLinejoin="round"

      // Hide decorative icons from screen readers.
      aria-hidden="true"

      // Allow additional properties such as className to be passed.
      {...props}
    >
      {/* Display the selected icon or nothing if the name is invalid. */}
      {paths[name] || null}
    </svg>
  );
}
