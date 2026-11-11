
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "./Icons";

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

function formatTime(value) {
  if (!value) return "Time unavailable";

  const parts = String(value).split(":");
  return `${parts[0]}:${parts[1]}`;
}

export function DashboardBookings({ bookings = [], role }) {
  const router = useRouter();

  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  async function update(id, status) {
    setBusy(`${id}-${status}`);
    setError("");

    try {
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

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            data.message ||
            "Unable to update booking."
        );
        return;
      }

      router.refresh();
    } catch (err) {
      console.error("Booking update failed:", err);
      setError(
        "Unable to update booking. Please try again."
      );
    } finally {
      setBusy("");
    }
  }

  if (!bookings.length) {
    return (
      <div className="panel p-10 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#edf1fa] text-[#26469b]">
          <Icon
            name="calendar"
            className="h-7 w-7"
          />
        </span>

        <h3 className="mt-5 text-xl font-bold">
          No bookings here yet
        </h3>

        <p className="mt-2 text-sm text-[#71809a]">
          {role === "student"
            ? "Browse tutors and send your first request."
            : "New student requests will appear here."}
        </p>

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

  return (
    <div className="space-y-4">
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700"
        >
          {error}
        </p>
      )}

      {bookings.map((booking) => {
        const bookingId = String(booking.id);

        const tutorName =
          booking.tutorName ||
          booking.tutor ||
          "Tutor";

        const studentName =
          booking.studentName ||
          booking.student ||
          "Student";

        const subject =
          booking.subjectName ||
          booking.subject ||
          "Tutoring session";

        const duration =
          booking.duration ??
          booking.duration_minutes ??
          60;

        return (
          <article
            key={bookingId}
            className="panel flex flex-col gap-5 p-5 sm:flex-row sm:items-center"
          >
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#edf1fa] text-[#26469b]">
              <Icon
                name="calendar"
                className="h-6 w-6"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-extrabold">
                  {role === "student"
                    ? tutorName
                    : studentName}
                </h3>

                <Status value={booking.status} />
              </div>

              <p className="mt-1 text-sm font-semibold text-[#58657d]">
                {subject}
              </p>

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

            <div className="flex flex-wrap gap-2">
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

function Status({ value }) {
  const color =
    value === "accepted"
      ? "bg-green-50 text-green-700"
      : value === "pending"
        ? "bg-amber-50 text-amber-700"
        : value === "completed"
          ? "bg-blue-50 text-blue-700"
          : "bg-slate-100 text-slate-600";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${color}`}
    >
      {value}
    </span>
  );
}
