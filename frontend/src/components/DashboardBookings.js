
// Enable client-side interactions in this component.
"use client";

// Import Link to navigate to tutor profiles and other pages.
import Link from "next/link";

// Import the router to refresh booking information.
import { useRouter } from "next/navigation";

// Import useState to manage errors and loading progress.
import { useState } from "react";

// Import the icons used in the booking dashboard.
import { Icon } from "./Icons";

// Format a booking date into a readable format.
function formatDate(value) {
  // Display a message if no date is available.
  if (!value) return "Date unavailable";

  // Extract the date and create a JavaScript Date object.
  const dateText = String(value).slice(0, 10);
  const date = new Date(`${dateText}T12:00:00Z`);

  // Return the original date if it cannot be formatted.
  if (Number.isNaN(date.getTime())) {
    return dateText;
  }

  // Display the date using Canadian English formatting.
  return date.toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Format the booking time to show hours and minutes.
function formatTime(value) {
  // Display a message if no time is available.
  if (!value) return "Time unavailable";

  // Separate the time into parts and remove seconds if present.
  const parts = String(value).split(":");
  return `${parts[0]}:${parts[1]}`;
}

// Create the component for managing bookings on user dashboards.
export function DashboardBookings({ bookings = [], role }) {
  // Initialize the router for refreshing booking information.
  const router = useRouter();

  // Store error messages and track which action is processing.
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  // Update the status of a booking.
  async function update(id, status) {
    // Track the selected booking and action.
    setBusy(`${id}-${status}`);

    // Clear previous error messages.
    setError("");

    try {
      // Send the booking ID and new status to the API.
      const response = await fetch("/api/bookings/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: String(id),
          status,
        }),
      });

      // Read the response returned by the API.
      const data = await response.json();

      // Display an error if the booking cannot be updated.
      if (!response.ok) {
        setError(
          data.error ||
            data.message ||
            "Unable to update booking."
        );
        return;
      }

      // Refresh the dashboard to show the updated booking status.
      router.refresh();
    } catch (err) {
      // Handle unexpected errors during the update.
      console.error("Booking update failed:", err);
      setError(
        "Unable to update booking. Please try again."
      );
    } finally {
      // Clear the loading state after the request finishes.
      setBusy("");
    }
  }

  // Display a message when the user has no bookings.
  if (!bookings.length) {
    return (
      <div className="panel p-10 text-center">
        {/* Display a calendar icon. */}
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#edf1fa] text-[#26469b]">
          <Icon
            name="calendar"
            className="h-7 w-7"
          />
        </span>

        <h3 className="mt-5 text-xl font-bold">
          No bookings here yet
        </h3>

        {/* Show a different message for students and tutors. */}
        <p className="mt-2 text-sm text-[#71809a]">
          {role === "student"
            ? "Browse tutors and send your first request."
            : "New student requests will appear here."}
        </p>

        {/* Allow students to browse tutors and make a booking. */}
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
      {/* Display an error message if a booking update fails. */}
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

        // Get the tutor's name or use a default value.
        const tutorName =
          booking.tutorName ||
          booking.tutor ||
          "Tutor";

        // Get the student's name or use a default value.
        const studentName =
          booking.studentName ||
          booking.student ||
          "Student";

        // Get the subject associated with the booking.
        const subject =
          booking.subjectName ||
          booking.subject ||
          "Tutoring session";

        // Get the session duration or use 60 minutes by default.
        const duration =
          booking.duration ??
          booking.duration_minutes ??
          60;

        return (
          <article
            key={bookingId}
            className="panel flex flex-col gap-5 p-5 sm:flex-row sm:items-center"
          >
            {/* Display a calendar icon for the booking. */}
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#edf1fa] text-[#26469b]">
              <Icon
                name="calendar"
                className="h-6 w-6"
              />
            </div>

            {/* Display the booking information. */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {/* Show the tutor's name to students and the student's name to tutors. */}
                <h3 className="font-extrabold">
                  {role === "student"
                    ? tutorName
                    : studentName}
                </h3>

                {/* Display the current booking status. */}
                <Status value={booking.status} />
              </div>

              {/* Display the subject of the tutoring session. */}
              <p className="mt-1 text-sm font-semibold text-[#58657d]">
                {subject}
              </p>

              {/* Display the booking date, time, and duration. */}
              <p className="mt-2 text-xs text-[#7c879a]">
                {formatDate(booking.date || booking.booking_date)}
                {" · "}
                {formatTime(
                  booking.startTime || booking.booking_time
                )}
                {" · "}
                {duration} min
              </p>
            </div>

            {/* Display the available actions based on the user's role and booking status. */}
            <div className="flex flex-wrap gap-2">
              {/* Allow tutors to accept or decline pending bookings. */}
              {role === "tutor" &&
                booking.status === "pending" && (
                  <>
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

              {/* Allow tutors to mark accepted bookings as completed. */}
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

              {/* Allow students to cancel pending or accepted bookings. */}
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

              {/* Allow students to open the tutor's public profile. */}
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

// Create a reusable badge for displaying booking statuses.
function Status({ value }) {
  // Choose the badge colour based on the booking status.
  const color =
    value === "accepted"
      ? "bg-green-50 text-green-700"
      : value === "pending"
        ? "bg-amber-50 text-amber-700"
        : value === "completed"
          ? "bg-blue-50 text-blue-700"
          : "bg-slate-100 text-slate-600";

  // Display the booking status using the selected colour.
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${color}`}
    >
      {value}
    </span>
  );
}
