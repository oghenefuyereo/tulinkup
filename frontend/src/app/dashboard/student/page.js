
import Link from "next/link";
import { cookies } from "next/headers";

import { DashboardBookings } from "@/components/DashboardBookings";
import { DashboardShell } from "@/components/DashboardShell";
import { SignedOutState } from "@/components/SignedOutState";

export const dynamic = "force-dynamic";

const API_URL =
  process.env.API_URL || "http://localhost:5001";

export default async function StudentDashboard() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tulinkup_token")?.value;

  if (!token) {
    return (
      <SignedOutState title="Log in with a student account" />
    );
  }

  // Get current authenticated user.
  const userResponse = await fetch(
    `${API_URL}/api/auth/me`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  if (!userResponse.ok) {
    return (
      <SignedOutState title="Log in with a student account" />
    );
  }

  const userData = await userResponse.json();
  const user = userData.user;

  if (!user || user.role !== "student") {
    return (
      <SignedOutState title="Log in with a student account" />
    );
  }

  // Retrieve student bookings.
  const bookingsResponse = await fetch(
    `${API_URL}/api/bookings`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  if (!bookingsResponse.ok) {
    throw new Error("Unable to load student bookings.");
  }

  const bookingsData = await bookingsResponse.json();
  const bookings = bookingsData.bookings ?? [];

  const pending = bookings.filter(
    (booking) => booking.status === "pending"
  );

  const upcoming = bookings.filter(
    (booking) => booking.status === "accepted"
  );

  const history = bookings.filter((booking) =>
    ["completed", "cancelled", "declined"].includes(
      booking.status
    )
  );

  const fullName =
    user.fullName || user.full_name || "Student";

  return (
    <DashboardShell role="student" name={fullName}>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <p className="eyebrow">Student dashboard</p>

          <h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em]">
            Welcome back, {fullName.split(" ")[0]}
          </h1>

          <p className="mt-2 text-[#71809a]">
            Here is what is happening with your learning.
          </p>
        </div>

        <Link href="/tutors" className="btn-primary">
          Browse tutors
        </Link>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Upcoming", upcoming.length],
          ["Pending", pending.length],
          [
            "Completed",
            bookings.filter(
              (booking) => booking.status === "completed"
            ).length,
          ],
          [
            "Cancelled",
            bookings.filter(
              (booking) => booking.status === "cancelled"
            ).length,
          ],
        ].map(([label, value]) => (
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
