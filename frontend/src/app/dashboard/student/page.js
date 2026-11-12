
// Import Link to navigate between pages in Next.js.
import Link from "next/link";

// Import cookies to access the student's authentication token.
import { cookies } from "next/headers";

// Import the components used to display the student dashboard.
import { DashboardBookings } from "@/components/DashboardBookings";
import { DashboardShell } from "@/components/DashboardShell";
import { SignedOutState } from "@/components/SignedOutState";

// Make sure the dashboard loads fresh information for each request.
export const dynamic = "force-dynamic";

// Set the Express backend URL for authentication and booking requests.
const API_URL =
  process.env.API_URL || "http://localhost:5001";

// Create the student dashboard and load the student's information.
export default async function StudentDashboard() {
  // Read the authentication token from the user's cookies.
  const cookieStore = await cookies();
  const token = cookieStore.get("tulinkup_token")?.value;

  // Show the login page message if the user is not signed in.
  if (!token) {
    return (
      <SignedOutState title="Log in with a student account" />
    );
  }

  // Get current authenticated user.
  // Send the token to the Express backend to verify the account.
  const userResponse = await fetch(
    `${API_URL}/api/auth/me`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  // Show the signed-out message if authentication fails.
  if (!userResponse.ok) {
    return (
      <SignedOutState title="Log in with a student account" />
    );
  }

  // Read the authenticated user's information.
  const userData = await userResponse.json();
  const user = userData.user;

  // Allow only student accounts to access this dashboard.
  if (!user || user.role !== "student") {
    return (
      <SignedOutState title="Log in with a student account" />
    );
  }

  // Retrieve student bookings.
  // Request the student's tutoring sessions from the backend.
  const bookingsResponse = await fetch(
    `${API_URL}/api/bookings`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  // Stop loading the dashboard if the bookings cannot be retrieved.
  if (!bookingsResponse.ok) {
    throw new Error("Unable to load student bookings.");
  }

  // Read the bookings or use an empty list if none are returned.
  const bookingsData = await bookingsResponse.json();
  const bookings = bookingsData.bookings ?? [];

  // Find booking requests that are still waiting for tutor approval.
  const pending = bookings.filter(
    (booking) => booking.status === "pending"
  );

  // Find sessions that have been accepted by tutors.
  const upcoming = bookings.filter(
    (booking) => booking.status === "accepted"
  );

  // Find completed, cancelled, and declined sessions.
  const history = bookings.filter((booking) =>
    ["completed", "cancelled", "declined"].includes(
      booking.status
    )
  );

  // Get the student's name or use a default name if unavailable.
  const fullName =
    user.fullName || user.full_name || "Student";

  // Display the student dashboard with booking information.
  return (
    <DashboardShell role="student" name={fullName}>
      {/* Display the welcome message and tutor browsing link. */}
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <p className="eyebrow">Student dashboard</p>

          {/* Welcome the student using their first name. */}
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em]">
            Welcome back, {fullName.split(" ")[0]}
          </h1>

          <p className="mt-2 text-[#71809a]">
            Here is what is happening with your learning.
          </p>
        </div>

        {/* Allow the student to explore available tutors. */}
        <Link href="/tutors" className="btn-primary">
          Browse tutors
        </Link>
      </div>

      {/* Display a summary of the student's booking activity. */}
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          // Count accepted sessions.
          ["Upcoming", upcoming.length],

          // Count booking requests waiting for approval.
          ["Pending", pending.length],

          // Count sessions that have been completed.
          [
            "Completed",
            bookings.filter(
              (booking) => booking.status === "completed"
            ).length,
          ],

          // Count sessions that have been cancelled.
          [
            "Cancelled",
            bookings.filter(
              (booking) => booking.status === "cancelled"
            ).length,
          ],
        ].map(([label, value]) => (
          // Create a summary card for each booking status.
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

      {/* Display tutoring sessions that have been accepted. */}
      <section className="mt-9">
        <h2 className="text-xl font-extrabold">
          Upcoming sessions
        </h2>

        <div className="mt-4">
          <DashboardBookings
            bookings={upcoming}
            role="student"
          />
        </div>
      </section>

      {/* Display booking requests that are waiting for tutor approval. */}
      <section className="mt-9">
        <h2 className="text-xl font-extrabold">
          Pending requests
        </h2>

        <div className="mt-4">
          <DashboardBookings
            bookings={pending}
            role="student"
          />
        </div>
      </section>

      {/* Show session history only when previous bookings exist. */}
      {history.length > 0 && (
        <section className="mt-9">
          <h2 className="text-xl font-extrabold">
            Session history
          </h2>

          <div className="mt-4">
            <DashboardBookings
              bookings={history}
              role="student"
            />
          </div>
        </section>
      )}
    </DashboardShell>
  );
}
