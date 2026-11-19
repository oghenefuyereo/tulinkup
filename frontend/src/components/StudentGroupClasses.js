"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const statusStyles = {
  confirmed: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-red-100 text-red-700",
  attended: "bg-blue-100 text-blue-700",
  absent: "bg-gray-100 text-gray-700",
};

function formatCurrency(cents) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(cents || 0) / 100);
}

function formatDate(value) {
  return new Date(value).toLocaleString("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function StudentGroupClasses() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  // Manage enrolment cancellation states.
  const [cancellingId, setCancellingId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Retrieve the student's enrolled classes.
  useEffect(() => {
    const controller = new AbortController();

    async function loadClasses() {
      try {
        const response = await fetch(
          "/api/group-classes/my-enrollments",
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Unable to load your classes."
          );
        }

        if (!controller.signal.aborted) {
          setClasses(data.enrollments || []);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadClasses();

    return () => controller.abort();
  }, []);

  // Allow a student to cancel their group class enrolment.
  async function handleCancelEnrollment(item) {
    if (cancellingId !== null) return;

    // Confirm cancellation before sending the request.
    const confirmed = window.confirm(
      `Are you sure you want to cancel your enrolment in "${item.title}"?`
    );

    if (!confirmed) return;

    setCancellingId(item.id);
    setActionError("");
    setSuccessMessage("");

    try {
      const response = await fetch(
        `/api/group-classes/${item.id}/cancel-enrollment`,
        {
          method: "PATCH",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to cancel your enrolment."
        );
      }

      // Update the enrolment without refreshing the page.
      setClasses((previous) =>
        previous.map((groupClass) =>
          groupClass.enrollment_id === item.enrollment_id
            ? {
                ...groupClass,
                enrollment_status:
                  data.enrollment.enrollment_status,
              }
            : groupClass
        )
      );

      // Display the cancellation confirmation.
      setSuccessMessage(
        data.message || "Your enrolment has been cancelled."
      );
    } catch (error) {
      setActionError(error.message);
    } finally {
      setCancellingId(null);
    }
  }

  // Identify upcoming classes and active live classrooms.
  const upcomingClasses = classes.filter(
    (item) =>
      item.enrollment_status === "confirmed" &&
      (
        item.status === "live" ||
        (
          item.status === "published" &&
          new Date(item.scheduled_at) > new Date()
        )
      )
  );

  // Identify completed classes.
  const completedClasses = classes.filter(
    (item) =>
      item.enrollment_status !== "cancelled" &&
      item.status !== "cancelled" &&
      (
        item.status === "completed" ||
        item.enrollment_status === "attended"
      )
  );

  // Identify cancelled classes.
  const cancelledClasses = classes.filter(
    (item) =>
      item.status === "cancelled" ||
      item.enrollment_status === "cancelled"
  );

  const statistics = [
    ["Total enrollments", classes.length],
    ["Upcoming / Live classes", upcomingClasses.length],
    ["Completed classes", completedClasses.length],
    ["Cancelled classes", cancelledClasses.length],
  ];

  const filteredClasses =
    filter === "upcoming"
      ? upcomingClasses
      : filter === "completed"
        ? completedClasses
        : filter === "cancelled"
          ? cancelledClasses
          : classes;

  return (
    <div className="space-y-6">
      {/* Dashboard heading */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">
            Student dashboard
          </p>

          <h1 className="mt-2 text-3xl font-extrabold text-[#17233d]">
            My Group Classes
          </h1>

          <p className="mt-2 text-sm text-[#64748b]">
            Manage your group learning sessions and
            track your enrollments.
          </p>
        </div>

        <Link
          href="/group-classes"
          className="btn-primary"
        >
          Explore Group Classes
        </Link>
      </div>

      {/* Cancellation success message */}
      {successMessage && (
        <div
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 p-5 text-sm text-green-700"
        >
          {successMessage}
        </div>
      )}

      {/* Cancellation error message */}
      {actionError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"
        >
          {actionError}
        </div>
      )}

      {/* Error state */}
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"
        >
          {error}
        </div>
      ) : loading ? (
        <div className="panel p-12 text-center">
          Loading your group classes...
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {statistics.map(([label, value]) => (
              <div
                key={label}
                className="panel p-5"
              >
                <p className="text-sm font-semibold text-[#64748b]">
                  {label}
                </p>

                <p className="mt-2 text-3xl font-extrabold text-[#173472]">
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl font-extrabold">
              Your Learning Sessions
            </h2>

            <select
              aria-label="Filter enrolled classes"
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value)
              }
              className="rounded-xl border border-[#dce3ee] bg-white px-4 py-3 text-sm font-bold"
            >
              <option value="all">
                All classes
              </option>

              <option value="upcoming">
                Upcoming / Live
              </option>

              <option value="completed">
                Completed
              </option>

              <option value="cancelled">
                Cancelled
              </option>
            </select>
          </div>

          {/* Empty state */}
          {filteredClasses.length === 0 ? (
            <div className="panel space-y-4 p-12 text-center">
              <h3 className="text-xl font-extrabold">
                {classes.length === 0
                  ? "You have not enrolled in any classes"
                  : "No matching classes"}
              </h3>

              <p className="text-sm text-[#64748b]">
                Discover affordable group classes and
                start learning with other students.
              </p>

              <Link
                href="/group-classes"
                className="btn-primary inline-block"
              >
                Browse Group Classes
              </Link>
            </div>
          ) : (
            <div className="grid gap-5">
              {filteredClasses.map((item) => {
                const isCancelled =
                  item.status === "cancelled" ||
                  item.enrollment_status === "cancelled";

                const isUpcoming =
                  item.status === "published" &&
                  new Date(item.scheduled_at) > new Date();

                // Identify an active live classroom.
                const isLive =
                  item.status === "live";

                const isConfirmed =
                  item.enrollment_status === "confirmed";

                const isFree =
                  Number(item.price_cents) === 0;

                // Verify that the payment requirements are satisfied.
                const hasValidPayment =
                  (
                    isFree &&
                    item.payment_status === "not_required"
                  ) ||
                  (
                    Number(item.price_cents) > 0 &&
                    item.payment_status === "paid" &&
                    Number(item.amount_paid_cents) >=
                      Number(item.price_cents)
                  );

                // Check whether the student can join the live classroom.
                const canJoin =
                  !isCancelled &&
                  isLive &&
                  isConfirmed &&
                  hasValidPayment;

                // Identify students waiting for the tutor to start.
                const isWaitingForTutor =
                  !isCancelled &&
                  item.status === "published" &&
                  isConfirmed &&
                  hasValidPayment;

                // Check whether the enrolment can be safely cancelled.
                const canCancel =
                  !isCancelled &&
                  isUpcoming &&
                  isFree &&
                  ["pending", "confirmed"].includes(
                    item.enrollment_status
                  ) &&
                  Number(item.amount_paid_cents) === 0 &&
                  ["not_required", "unpaid", "failed"].includes(
                    item.payment_status
                  );

                // Check whether a cancelled enrolment can be reactivated.
                const canReEnroll =
                  item.enrollment_status === "cancelled" &&
                  isUpcoming &&
                  isFree &&
                  Number(item.amount_paid_cents) === 0 &&
                  ["not_required", "unpaid", "failed"].includes(
                    item.payment_status
                  );

                // Identify the enrolment currently being cancelled.
                const isCancelling =
                  cancellingId === item.id;

                return (
                  <article
                    key={item.enrollment_id}
                    className="panel overflow-hidden"
                  >
                    <div className="grid md:grid-cols-[180px_1fr]">
                      {/* Class cover */}
                      <div className="flex min-h-40 flex-col justify-between bg-gradient-to-br from-[#173472] to-[#4269c5] p-5 text-white">
                        <p className="text-xs font-bold uppercase tracking-wide text-blue-100">
                          Group Live Class
                        </p>

                        <div>
                          <p className="text-xs text-blue-100">
                            {item.education_level}
                          </p>

                          <h3 className="mt-2 text-xl font-extrabold">
                            {item.subject}
                          </h3>
                        </div>
                      </div>

                      {/* Class information */}
                      <div className="space-y-5 p-6">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-xl font-extrabold">
                              {item.title}
                            </h3>

                            <p className="mt-1 text-sm text-[#64748b]">
                              With {item.tutor_name || "Tutor"}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {/* Display the current enrolment status. */}
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${
                                statusStyles[
                                  item.enrollment_status
                                ] || statusStyles.pending
                              }`}
                            >
                              {item.enrollment_status}
                            </span>

                            {/* Display a live classroom indicator. */}
                            {isLive && !isCancelled && (
                              <span className="flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                                <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" />
                                Live Now
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="line-clamp-2 text-sm leading-6 text-[#64748b]">
                          {item.description}
                        </p>

                        {/* Session details */}
                        <div className="grid gap-4 rounded-xl bg-[#f7f9fd] p-4 sm:grid-cols-2 lg:grid-cols-3">
                          <div>
                            <p className="text-xs font-bold text-[#8190a8]">
                              DATE AND TIME
                            </p>

                            <p className="mt-1 text-sm font-bold">
                              {formatDate(item.scheduled_at)}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-bold text-[#8190a8]">
                              DURATION
                            </p>

                            <p className="mt-1 text-sm font-bold">
                              {item.duration_minutes} minutes
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-bold text-[#8190a8]">
                              AMOUNT PAID
                            </p>

                            <p className="mt-1 text-sm font-bold">
                              {isFree
                                ? "Free"
                                : formatCurrency(
                                    item.amount_paid_cents
                                  )}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-bold text-[#8190a8]">
                              PAYMENT STATUS
                            </p>

                            <p className="mt-1 text-sm font-bold capitalize">
                              {item.payment_status?.replaceAll(
                                "_",
                                " "
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-bold text-[#8190a8]">
                              CLASS STATUS
                            </p>

                            <p className="mt-1 text-sm font-bold capitalize">
                              {item.status}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-bold text-[#8190a8]">
                              ENROLLED ON
                            </p>

                            <p className="mt-1 text-sm font-bold">
                              {new Date(
                                item.enrolled_at
                              ).toLocaleDateString("en-CA")}
                            </p>
                          </div>
                        </div>

                        {/* Class actions */}
                        <div className="flex flex-wrap gap-3 border-t border-[#edf0f5] pt-4">
                          {item.status === "published" && (
                            <Link
                              href={`/group-classes/${item.id}`}
                              className="btn-secondary"
                            >
                              {canReEnroll
                                ? "Re-enrol in Class"
                                : "View Class Details"}
                            </Link>
                          )}

                          {/* Allow eligible students to join the live classroom. */}
                          {canJoin && (
                            <Link
                              href={`/classroom/group/${item.id}`}
                              className="rounded-xl bg-[#26469b] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#173472]"
                            >
                              Join Live Class
                            </Link>
                          )}

                          {/* Display a waiting button before the tutor starts. */}
                          {isWaitingForTutor && (
                            <button
                              type="button"
                              disabled
                              title="The tutor has not started the classroom."
                              className="cursor-not-allowed rounded-xl bg-[#26469b] px-5 py-3 text-sm font-bold text-white opacity-50"
                            >
                              Waiting for Tutor
                            </button>
                          )}

                          {/* Allow students to cancel eligible enrolments. */}
                          {canCancel && (
                            <button
                              type="button"
                              disabled={cancellingId !== null}
                              onClick={() =>
                                handleCancelEnrollment(item)
                              }
                              className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isCancelling
                                ? "Cancelling..."
                                : "Cancel Enrolment"}
                            </button>
                          )}

                          {/* Display the appropriate cancellation status. */}
                          {isCancelled && (
                            <span className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                              {item.status === "cancelled"
                                ? "Class cancelled"
                                : "Enrolment cancelled"}
                            </span>
                          )}
                        </div>

                        {/* Display the live classroom availability notice. */}
                        {canJoin && (
                          <p className="text-xs font-semibold text-green-700">
                            Your tutor has started the live
                            classroom. You can now join the
                            learning session, subject to the
                            scheduled access window.
                          </p>
                        )}

                        {/* Display the waiting classroom notice. */}
                        {isWaitingForTutor && (
                          <p className="text-xs text-[#64748b]">
                            The classroom will become available
                            when your tutor starts the live
                            session. Refresh this page to check
                            for updates.
                          </p>
                        )}

                        {/* Display outstanding payment requirements. */}
                        {!isCancelled &&
                          isConfirmed &&
                          !hasValidPayment &&
                          ["published", "live"].includes(
                            item.status
                          ) && (
                            <p className="text-xs font-semibold text-amber-700">
                              Payment requirements must be
                              satisfied before joining this
                              classroom.
                            </p>
                          )}

                        {/* Display the completed classroom notice. */}
                        {!isCancelled &&
                          item.status === "completed" && (
                            <p className="text-xs font-semibold text-green-700">
                              This learning session has ended.
                            </p>
                          )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}