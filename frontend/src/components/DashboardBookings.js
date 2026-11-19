
// Enable client-side interactions.
"use client";

// Import required components and hooks.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "./Icons";

// Format a booking date into a readable format.
function formatDate(value) {
  if (!value) return "Date unavailable";

  const dateText = String(value).slice(0, 10);
  const date = new Date(`${dateText}T12:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return dateText;
  }

  return date.toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Format the booking time.
function formatTime(value) {
  if (!value) return "Time unavailable";

  const parts = String(value).split(":");

  return `${parts[0]}:${parts[1]}`;
}

// Create the component for managing dashboard bookings.
export function DashboardBookings({
  bookings = [],
  role,
}) {
  const router = useRouter();

  // Manage error messages and loading progress.
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  // Update the status of a booking.
  async function update(id, status) {
    // Prevent multiple requests at the same time.
    if (busy) return;

    // Track the selected booking and action.
    setBusy(`${id}-${status}`);

    // Clear previous errors.
    setError("");

    try {
      // Send the booking update to the correct API.
      const response = await fetch(
        "/api/bookings/status",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            id: String(id),
            status,
          }),
        }
      );

      // Safely read the API response.
      const data = await response
        .json()
        .catch(() => null);

      // Handle unsuccessful booking updates.
      if (!response.ok) {
        setError(
          data?.error ||
            data?.message ||
            `Unable to update booking (${response.status}).`
        );

        return;
      }

      // Handle invalid or unexpected responses.
      if (!data || data.success === false) {
        setError(
          data?.error ||
            data?.message ||
            "The booking service returned an invalid response."
        );

        return;
      }

      // Refresh the dashboard to display the updated booking.
      router.refresh();
    } catch (err) {
      // Log unexpected errors.
      console.error("Booking update failed:", err);

      setError(
        "Unable to update booking. Please try again."
      );
    } finally {
      // Clear the loading state.
      setBusy("");
    }
  }

  // Display a message when there are no bookings.
  if (!bookings.length) {
    return (
      <div className="panel p-10 text-center">
        {/* Display the booking calendar icon. */}
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#edf1fa] text-[#26469b]">
          <Icon
            name="calendar"
            className="h-7 w-7"
          />
        </span>

        <h3 className="mt-5 text-xl font-bold">
          No bookings here yet
        </h3>

        {/* Display a message based on the user's role. */}
        <p className="mt-2 text-sm text-[#71809a]">
          {role === "student"
            ? "Browse tutors and send your first request."
            : "New student requests will appear here."}
        </p>

        {/* Allow students to browse available tutors. */}
        {role === "student" && (
          <Link
            href="/tutors"
            className="btn-primary mt-6"
          >
            Browse tutors
          </Link>
        )}
      </div>
    );
  }

  // Display the user's existing bookings.
  return (
    <div className="space-y-4">
      {/* Display booking update errors. */}
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700"
        >
          {error}
        </p>
      )}

      {/* Create a card for each booking. */}
      {bookings.map((booking) => {
        // Convert the booking ID into a string.
        const bookingId = String(booking.id);

        // Retrieve the tutor's name.
        const tutorName =
          booking.tutorName ||
          booking.tutor ||
          "Tutor";

        // Retrieve the student's name.
        const studentName =
          booking.studentName ||
          booking.student ||
          "Student";

        // Retrieve the booked subject.
        const subject =
          booking.subjectName ||
          booking.subject ||
          "Tutoring session";

        // Retrieve the session duration.
        const duration =
          booking.duration ??
          booking.duration_minutes ??
          60;

        return (
          <article
            key={bookingId}
            className="panel flex flex-col gap-5 p-5 sm:flex-row sm:items-center"
          >
            {/* Display the calendar icon. */}
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#edf1fa] text-[#26469b]">
              <Icon
                name="calendar"
                className="h-6 w-6"
              />
            </div>

            {/* Display booking information. */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {/* Display the tutor or student name. */}
                <h3 className="font-extrabold">
                  {role === "student"
                    ? tutorName
                    : studentName}
                </h3>

                {/* Display the current booking status. */}
                <Status value={booking.status} />
              </div>

              {/* Display the booked subject. */}
              <p className="mt-1 text-sm font-semibold text-[#58657d]">
                {subject}
              </p>

              {/* Display the session date, time, and duration. */}
              <p className="mt-2 text-xs text-[#7c879a]">
                {formatDate(
                  booking.date || booking.booking_date
                )}

                {" · "}

                {formatTime(
                  booking.startTime ||
                    booking.booking_time
                )}

                {" · "}

                {duration} min
              </p>

              {/* Display the live classroom integration notice. */}
              {["tutor", "student"].includes(role) &&
                booking.status === "accepted" && (
                  <p className="mt-2 text-xs text-[#64748b]">
                    Live session access will become
                    available after video integration.
                  </p>
                )}
            </div>

            {/* Display actions based on role and status. */}
            <div className="flex flex-wrap gap-2">

              {/* Allow tutors to start an accepted live session. */}
              {role === "tutor" &&
                booking.status === "accepted" && (
                  <button
                    type="button"
                    disabled
                    title="Live classroom integration is pending"
                    className="cursor-not-allowed rounded-xl bg-[#26469b] px-4 py-2.5 text-sm font-bold text-white opacity-50"
                  >
                    Start Live Session
                  </button>
                )}

              {/* Allow students to join an accepted live session. */}
              {role === "student" &&
                booking.status === "accepted" && (
                  <button
                    type="button"
                    disabled
                    title="Live classroom integration is pending"
                    className="cursor-not-allowed rounded-xl bg-[#26469b] px-4 py-2.5 text-sm font-bold text-white opacity-50"
                  >
                    Join Live Session
                  </button>
                )}

              {/* Allow tutors to accept or decline pending bookings. */}
              {role === "tutor" &&
                booking.status === "pending" && (
                  <>
                    {/* Accept booking. */}
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        update(bookingId, "accepted")
                      }
                      className="btn-primary px-4 py-2.5 disabled:opacity-50"
                    >
                      {busy === `${bookingId}-accepted`
                        ? "Accepting..."
                        : "Accept"}
                    </button>

                    {/* Decline booking. */}
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        update(bookingId, "declined")
                      }
                      className="btn-secondary px-4 py-2.5 disabled:opacity-50"
                    >
                      {busy === `${bookingId}-declined`
                        ? "Declining..."
                        : "Decline"}
                    </button>
                  </>
                )}

              {/* Allow tutors to complete accepted bookings. */}
              {role === "tutor" &&
                booking.status === "accepted" && (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      update(bookingId, "completed")
                    }
                    className="btn-primary px-4 py-2.5 disabled:opacity-50"
                  >
                    {busy === `${bookingId}-completed`
                      ? "Updating..."
                      : "Mark completed"}
                  </button>
                )}

              {/* Allow students to cancel their bookings. */}
              {role === "student" &&
                ["pending", "accepted"].includes(
                  booking.status
                ) && (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      update(bookingId, "cancelled")
                    }
                    className="btn-secondary px-4 py-2.5 disabled:opacity-50"
                  >
                    {busy === `${bookingId}-cancelled`
                      ? "Cancelling..."
                      : "Cancel"}
                  </button>
                )}

              {/* Allow students to view the tutor's profile. */}
              {role === "student" &&
                booking.tutorSlug && (
                  <Link
                    href={`/tutors/${booking.tutorSlug}`}
                    className="btn-secondary px-4 py-2.5"
                  >
                    View tutor
                  </Link>
                )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

// Create a reusable booking status badge.
function Status({ value }) {
  // Select the badge colour based on the booking status.
  const color =
    value === "accepted"
      ? "bg-green-50 text-green-700"
      : value === "pending"
        ? "bg-amber-50 text-amber-700"
        : value === "completed"
          ? "bg-blue-50 text-blue-700"
          : "bg-slate-100 text-slate-600";

  // Display the booking status.
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${color}`}
    >
      {value}
    </span>
  );
}
