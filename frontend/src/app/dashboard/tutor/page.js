
import Link from "next/link";
import { cookies } from "next/headers";

import { DashboardBookings } from "@/components/DashboardBookings";
import { DashboardShell } from "@/components/DashboardShell";
import { SignedOutState } from "@/components/SignedOutState";

export const dynamic = "force-dynamic";

const API_URL = process.env.API_URL || "http://localhost:5001";

async function getAuthenticatedTutor(token) {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) return null;

  const data = await response.json();

  return data.user || null;
}

async function getTutorBookings(token) {
  const response = await fetch(`${API_URL}/api/bookings`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to load tutor bookings.");
  }

  const data = await response.json();

  return Array.isArray(data.bookings) ? data.bookings : [];
}

async function getTutorProfile(token) {
  const response = await fetch(`${API_URL}/api/tutors/me/profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Unable to load tutor profile.");
  }

  const data = await response.json();

  return data.profile || null;
}

export default async function TutorDashboard() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tulinkup_token")?.value;

  if (!token) {
    return (
      <SignedOutState title="Log in with a tutor account" />
    );
  }

  let user;

  try {
    user = await getAuthenticatedTutor(token);
  } catch (error) {
    console.error("Tutor authentication error:", error);

    return (
      <SignedOutState title="Unable to verify your tutor account" />
    );
  }

  if (!user || user.role !== "tutor") {
    return (
      <SignedOutState title="Log in with a tutor account" />
    );
  }

  const [bookings, profile] = await Promise.all([
    getTutorBookings(token),
    getTutorProfile(token),
  ]);

  const fullName =
    user.fullName || user.full_name || "Tutor";

  const firstName = fullName.split(" ")[0];

  const pending = bookings.filter(
    (booking) => booking.status === "pending"
  );

  const upcoming = bookings.filter(
    (booking) => booking.status === "accepted"
  );

  const completed = bookings.filter(
    (booking) => booking.status === "completed"
  );

  const completion = profile ? 100 : 25;

  return (
    <DashboardShell role="tutor" name={fullName}>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <p className="eyebrow">Tutor dashboard</p>

          <h1 className="mt-2 text-3xl font-extrabold tracking-[-.04em]">
            Welcome, {firstName}
          </h1>

          <p className="mt-2 text-[#71809a]">
            Manage requests, sessions, and your tutoring profile.
          </p>
        </div>

        <div className="flex gap-3">
          <Link href="/profile" className="btn-secondary">
            Manage profile
          </Link>

          <Link href="/availability" className="btn-primary">
            Set availability
          </Link>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Pending requests", pending.length],
          ["Upcoming", upcoming.length],
          ["Completed", completed.length],
          ["Total bookings", bookings.length],
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

      <div className="panel mt-6 p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold">
            Profile completion
          </span>

          <span className="font-extrabold text-[#26469b]">
            {completion}%
          </span>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#edf0f5]">
          <div
            className="h-full rounded-full bg-[#25ad61]"
            style={{ width: `${completion}%` }}
          />
        </div>

        {!profile && (
          <p className="mt-3 text-sm text-[#71809a]">
            Complete your profile to appear in tutor search.
          </p>
        )}
      </div>

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
