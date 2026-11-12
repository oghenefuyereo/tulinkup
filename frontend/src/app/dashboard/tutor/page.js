
// Import Link to navigate between pages in Next.js.
import Link from "next/link";

// Import cookies to access the tutor's authentication token.
import { cookies } from "next/headers";

// Import the components used to display the tutor dashboard.
import { DashboardBookings } from "@/components/DashboardBookings";
import { DashboardShell } from "@/components/DashboardShell";
import { SignedOutState } from "@/components/SignedOutState";

// Make sure the dashboard loads fresh information for each request.
export const dynamic = "force-dynamic";

// Set the Express backend URL for API requests.
const API_URL = process.env.API_URL || "http://localhost:5001";

// Create a helper function to verify the tutor's account.
async function getAuthenticatedTutor(token) {
  // Send the authentication token to the Express backend.
  const response = await fetch(`${API_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  // Return null if authentication fails.
  if (!response.ok) return null;

  // Read the authenticated user's information.
  const data = await response.json();

  // Return the user or null if no account information is available.
  return data.user || null;
}

// Create a helper function to retrieve the tutor's bookings.
async function getTutorBookings(token) {
  // Request the tutor's booking information from the backend.
  const response = await fetch(`${API_URL}/api/bookings`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  // Stop loading if the backend cannot retrieve the bookings.
  if (!response.ok) {
    throw new Error("Unable to load tutor bookings.");
  }

  // Read the booking information returned by the backend.
  const data = await response.json();

  // Return the bookings or an empty list if none are available.
  return Array.isArray(data.bookings) ? data.bookings : [];
}

// Create a helper function to retrieve the tutor's profile.
async function getTutorProfile(token) {
  // Request the tutor's professional profile from the backend.
  const response = await fetch(`${API_URL}/api/tutors/me/profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  // Return null if the tutor has not created a profile.
  if (response.status === 404) {
    return null;
  }

  // Stop loading if the profile cannot be retrieved.
  if (!response.ok) {
    throw new Error("Unable to load tutor profile.");
  }

  // Read the profile information returned by the backend.
  const data = await response.json();

  // Return the tutor's profile or null if none exists.
  return data.profile || null;
}

// Create the main dashboard for authenticated tutor accounts.
export default async function TutorDashboard() {
  // Read the tutor's authentication token from the stored cookie.
  const cookieStore = await cookies();
  const token = cookieStore.get("tulinkup_token")?.value;

  // Show the login message if the tutor is not signed in.
  if (!token) {
    return (
      <SignedOutState title="Log in with a tutor account" />
    );
  }

  // Create a variable to store the authenticated user's information.
  let user;

  try {
    // Verify the tutor's login through the Express backend.
    user = await getAuthenticatedTutor(token);
  } catch (error) {
    // Log unexpected authentication errors.
    console.error("Tutor authentication error:", error);

    // Show an error message if the account cannot be verified.
    return (
      <SignedOutState title="Unable to verify your tutor account" />
    );
  }

  // Allow only authenticated tutor accounts to access the dashboard.
  if (!user || user.role !== "tutor") {
    return (
      <SignedOutState title="Log in with a tutor account" />
    );
  }

  // Load the tutor's bookings and profile at the same time.
  const [bookings, profile] = await Promise.all([
    getTutorBookings(token),
    getTutorProfile(token),
  ]);

  // Get the tutor's full name or use a default name.
  const fullName =
    user.fullName || user.full_name || "Tutor";

  // Get the tutor's first name for the welcome message.
  const firstName = fullName.split(" ")[0];

  // Find booking requests waiting for the tutor's response.
  const pending = bookings.filter(
    (booking) => booking.status === "pending"
  );

  // Find tutoring sessions that have been accepted.
  const upcoming = bookings.filter(
    (booking) => booking.status === "accepted"
  );

  // Find tutoring sessions that have been completed.
  const completed = bookings.filter(
    (booking) => booking.status === "completed"
  );

  // Set the displayed profile completion percentage.
  const completion = profile ? 100 : 25;

  // Display the tutor dashboard with profile and booking information.
  return (
    <DashboardShell role="tutor" name={fullName}>
      {/* Display the welcome message and profile management links. */}
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <p className="eyebrow">Tutor dashboard</p>

          {/* Welcome the tutor using their first name. */}
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em]">
            Welcome, {firstName}
          </h1>

          <p className="mt-2 text-[#71809a]">
            Manage requests, sessions, and your tutoring profile.
          </p>
        </div>

        {/* Provide links to manage the tutor's profile and availability. */}
        <div className="flex gap-3">
          <Link href="/profile" className="btn-secondary">
            Manage profile
          </Link>

          <Link href="/availability" className="btn-primary">
            Set availability
          </Link>
        </div>
      </div>

      {/* Display summary cards showing the tutor's booking activity. */}
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          // Count booking requests waiting for approval.
          ["Pending requests", pending.length],

          // Count accepted tutoring sessions.
          ["Upcoming", upcoming.length],

          // Count completed tutoring sessions.
          ["Completed", completed.length],

          // Count all bookings associated with the tutor.
          ["Total bookings", bookings.length],
        ].map(([label, value]) => (
          // Create a summary card for each booking category.
          <div className="panel p-5" key={label}>
            <p className="text-sm font-semibold text-[#7c879a]">
              {label}
            </p>

            <p className="mt-2 text-3xl font-extrabold text-[#173472]">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Display the tutor's profile completion indicator. */}
      <div className="panel mt-6 p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold">
            Profile completion
          </span>

          {/* Show the current profile completion percentage. */}
          <span className="font-extrabold text-[#26469b]">
            {completion}%
          </span>
        </div>

        {/* Display a progress bar based on profile completion. */}
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#edf0f5]">
          <div
            className="h-full rounded-full bg-[#25ad61]"
            style={{ width: `${completion}%` }}
          />
        </div>

        {/* Encourage tutors without profiles to complete their information. */}
        {!profile && (
          <p className="mt-3 text-sm text-[#71809a]">
            Complete your profile to appear in tutor search.
          </p>
        )}
      </div>

      {/* Display booking requests that need the tutor's attention. */}
      <section className="mt-9">
        <h2 className="text-xl font-extrabold">
          Booking requests
        </h2>

        <div className="mt-4">
          <DashboardBookings
            bookings={pending}
            role="tutor"
          />
        </div>
      </section>

      {/* Display tutoring sessions that have been accepted. */}
      <section className="mt-9">
        <h2 className="text-xl font-extrabold">
          Upcoming sessions
        </h2>

        <div className="mt-4">
          <DashboardBookings
            bookings={upcoming}
            role="tutor"
          />
        </div>
      </section>
    </DashboardShell>
  );
}
