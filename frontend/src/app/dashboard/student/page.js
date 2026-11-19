
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

  // Store the authenticated user's information.
  let user = null;

  // Track unexpected authentication errors.
  let authenticationError = false;

  try {
    // Send the token to the Express backend to verify the account.
    const userResponse = await fetch(
      `${API_URL}/api/auth/me`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      }
    );

    // Read the authenticated user's information if verification succeeds.
    if (userResponse.ok) {
      const userData = await userResponse.json();
      user = userData.user;
    }
  } catch (error) {
    // Handle unexpected authentication errors.
    console.error("Student authentication error:", error);

    authenticationError = true;
  }

  // Display the authentication error outside the try/catch block.
  if (authenticationError) {
    return (
      <SignedOutState title="Unable to verify your student account" />
    );
  }

  // Allow only student accounts to access this dashboard.
  if (!user || user.role !== "student") {
    return (
      <SignedOutState title="Log in with a student account" />
    );
  }

  // Request the student's one-on-one tutoring sessions.
  const bookingsResponse = await fetch(
    `${API_URL}/api/bookings`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    }
  );

  // Stop loading if the bookings cannot be retrieved.
  if (!bookingsResponse.ok) {
    throw new Error("Unable to load student bookings.");
  }

  // Read the bookings or use an empty list.
  const bookingsData = await bookingsResponse.json();

  const bookings = Array.isArray(bookingsData.bookings)
    ? bookingsData.bookings
    : [];

  // Find booking requests waiting for tutor approval.
  const pending = bookings.filter(
    (booking) => booking.status === "pending"
  );

  // Find sessions that have been accepted by tutors.
  const upcoming = bookings.filter(
    (booking) => booking.status === "accepted"
  );

  // Find completed tutoring sessions.
  const completed = bookings.filter(
    (booking) => booking.status === "completed"
  );

  // Find cancelled tutoring sessions.
  const cancelled = bookings.filter(
    (booking) => booking.status === "cancelled"
  );

  // Find completed, cancelled, and declined sessions.
  const history = bookings.filter((booking) =>
    ["completed", "cancelled", "declined"].includes(
      booking.status
    )
  );

  // Get the student's name or use a default name.
  const fullName =
    user.fullName || user.full_name || "Student";

  // Get the student's first name.
  const firstName = fullName.split(" ")[0];

  // Display the student dashboard.
  return (
    <DashboardShell role="student" name={fullName}>
      {/* Display the welcome message and learning options. */}
      <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
        <div>
          <p className="eyebrow">Student dashboard</p>

          {/* Welcome the student using their first name. */}
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em]">
            Welcome back, {firstName}
          </h1>

          <p className="mt-2 text-[#71809a]">
            Here is what is happening with your learning.
          </p>
        </div>

        {/* Allow students to explore tutors and group classes. */}
        <div className="flex flex-wrap gap-3">
          <Link
            href="/tutors"
            className="btn-secondary"
          >
            Browse tutors
          </Link>

          <Link
            href="/group-classes"
            className="btn-primary"
          >
            Browse Group Classes
          </Link>
        </div>
      </div>

      {/* Display a summary of one-on-one tutoring activity. */}
      <section
        className="mt-8"
        aria-labelledby="booking-summary"
      >
        <h2
          id="booking-summary"
          className="mb-4 text-lg font-extrabold"
        >
          One-on-One Tutoring
        </h2>

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[
            // Count accepted sessions.
            ["Upcoming", upcoming.length],

            // Count pending booking requests.
            ["Pending", pending.length],

            // Count completed sessions.
            ["Completed", completed.length],

            // Count cancelled sessions.
            ["Cancelled", cancelled.length],
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
      </section>

      {/* Display the TuLinkUp group learning section. */}
      <section
        className="mt-8"
        aria-labelledby="group-learning-heading"
      >
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#173472] to-[#4269c5] p-6 text-white md:p-8">
          {/* Display decorative background elements. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/5"
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 right-24 h-56 w-56 rounded-full bg-white/5"
          />

          {/* Display group learning information and actions. */}
          <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
            <div className="max-w-xl">
              <p className="text-xs font-bold uppercase tracking-widest text-[#f5c518]">
                TuLinkUp Group Learning
              </p>

              <h2
                id="group-learning-heading"
                className="mt-3 text-2xl font-extrabold md:text-3xl"
              >
                Learn Together. Spend Less.
              </h2>

              <p className="mt-3 text-sm leading-6 text-blue-100">
                Discover affordable group classes, learn
                alongside other students, and develop your
                skills with experienced tutors.
              </p>

              {/* Highlight the benefits of group learning. */}
              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  "Affordable learning",
                  "Group learning",
                  "Flexible class options",
                ].map((benefit) => (
                  <span
                    key={benefit}
                    className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    {benefit}
                  </span>
                ))}
              </div>
            </div>

            {/* Display group class navigation buttons. */}
            <div className="flex flex-wrap gap-3">
              {/* Browse available group classes. */}
              <Link
                href="/group-classes"
                className="rounded-xl bg-[#f5c518] px-5 py-3 text-center text-sm font-extrabold text-[#17233d] transition-colors hover:bg-[#ffda44]"
              >
                Explore Classes
              </Link>

              {/* Access the student's enrolled group classes. */}
              <Link
                href="/dashboard/student/group-classes"
                className="rounded-xl border border-white/40 px-5 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-white/10"
              >
                My Group Classes
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Display tutoring sessions that have been accepted. */}
      <section className="mt-9">
        <h2 className="text-xl font-extrabold">
          Upcoming sessions
        </h2>

        <p className="mt-1 text-sm text-[#71809a]">
          Your accepted one-on-one tutoring sessions.
        </p>

        <div className="mt-4">
          <DashboardBookings
            bookings={upcoming}
            role="student"
          />
        </div>
      </section>

      {/* Display booking requests waiting for tutor approval. */}
      <section className="mt-9">
        <h2 className="text-xl font-extrabold">
          Pending requests
        </h2>

        <p className="mt-1 text-sm text-[#71809a]">
          Tutoring requests waiting for a response.
        </p>

        <div className="mt-4">
          <DashboardBookings
            bookings={pending}
            role="student"
          />
        </div>
      </section>

      {/* Show session history when previous bookings exist. */}
      {history.length > 0 && (
        <section className="mt-9">
          <h2 className="text-xl font-extrabold">
            Session history
          </h2>

          <p className="mt-1 text-sm text-[#71809a]">
            Review your previous tutoring sessions.
          </p>

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
