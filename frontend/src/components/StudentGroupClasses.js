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

const paymentStyles = {
  paid: "bg-green-100 text-green-700",
  not_required: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  unpaid: "bg-yellow-100 text-yellow-700",
  failed: "bg-red-100 text-red-700",
  refunded: "bg-blue-100 text-blue-700",
};

const paymentLabels = {
  paid: "Paid",
  not_required: "No payment required",
  pending: "Payment pending",
  unpaid: "Unpaid",
  failed: "Payment failed",
  refunded: "Refunded",
};

// Format an amount in Canadian dollars.
function formatCurrency(cents) {
  if (
    cents == null ||
    cents === "" ||
    !Number.isSafeInteger(Number(cents)) ||
    Number(cents) < 0
  ) {
    return "Unavailable";
  }

  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Number(cents) / 100);
}

// Format the scheduled class date and time.
function formatDate(value) {
  return new Date(value).toLocaleString("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// Retrieve the price recorded when the student enrolled.
function getEnrollmentPrice(item) {
  const value = item.enrollment_price_cents;

  if (value == null || value === "") {
    return null;
  }

  const priceCents = Number(value);

  if (
    !Number.isSafeInteger(priceCents) ||
    priceCents < 0
  ) {
    return null;
  }

  return priceCents;
}

// Retrieve the current class price.
function getClassPrice(item) {
  if (item.price_cents == null || item.price_cents === "") {
    return null;
  }

  const priceCents = Number(item.price_cents);

  return Number.isSafeInteger(priceCents) &&
    priceCents >= 0
    ? priceCents
    : null;
}

// Verify that the student's payment requirements are satisfied.
function hasEligiblePayment(item) {
  const enrollmentPrice = getEnrollmentPrice(item);
  const classPrice = getClassPrice(item);

  const priceCents = enrollmentPrice ?? classPrice;

  if (
    priceCents === null ||
    classPrice === null ||
    item.amount_paid_cents == null ||
    item.amount_paid_cents === ""
  ) {
    return false;
  }

  const amountPaid = Number(item.amount_paid_cents);

  if (
    !Number.isSafeInteger(amountPaid) ||
    amountPaid < 0
  ) {
    return false;
  }

  if (priceCents === 0 && classPrice === 0) {
    return (
      item.payment_status === "not_required" &&
      amountPaid === 0
    );
  }

  return (
    priceCents > 0 &&
    classPrice > 0 &&
    item.payment_status === "paid" &&
    amountPaid >= priceCents &&
    amountPaid >= classPrice
  );
}

// Check whether a free enrolment can be cancelled or reactivated.
function hasNoPaymentObligation(item) {
  const enrollmentPrice = getEnrollmentPrice(item);
  const classPrice = getClassPrice(item);

  return (
    classPrice === 0 &&
    (enrollmentPrice === null || enrollmentPrice === 0) &&
    item.amount_paid_cents != null &&
    item.amount_paid_cents !== "" &&
    Number(item.amount_paid_cents) === 0 &&
    ["not_required", "unpaid", "failed"].includes(
      item.payment_status
    )
  );
}

// Check whether the student can cancel their enrolment.
function canCancelEnrollment(item) {
  return (
    item.status === "published" &&
    new Date(item.scheduled_at) > new Date() &&
    ["pending", "confirmed"].includes(
      item.enrollment_status
    ) &&
    hasNoPaymentObligation(item)
  );
}

// Check whether a cancelled enrolment can be reactivated.
function canReactivateEnrollment(item) {
  return (
    item.enrollment_status === "cancelled" &&
    item.status === "published" &&
    new Date(item.scheduled_at) > new Date() &&
    hasNoPaymentObligation(item)
  );
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
          setClasses(
            Array.isArray(data.enrollments)
              ? data.enrollments
              : []
          );
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
    if (
      cancellingId !== null ||
      !canCancelEnrollment(item)
    ) {
      return;
    }

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
                payment_status:
                  data.enrollment.payment_status ??
                  groupClass.payment_status,
                amount_paid_cents:
                  data.enrollment.amount_paid_cents ??
                  groupClass.amount_paid_cents,
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

  // Identify enrolments with outstanding payment requirements.
  const pendingPaymentClasses = classes.filter(
    (item) =>
      item.status !== "cancelled" &&
      item.status !== "completed" &&
      ["pending", "confirmed"].includes(
        item.enrollment_status
      ) &&
      (getEnrollmentPrice(item) ?? getClassPrice(item)) > 0 &&
      ["unpaid", "pending", "failed"].includes(
        item.payment_status
      )
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
          : filter === "pending-payment"
            ? pendingPaymentClasses
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
            Manage your group learning sessions, track
            your enrollments and review your payments.
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

          {/* Outstanding payment notice */}
          {pendingPaymentClasses.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <h3 className="text-sm font-extrabold text-amber-800">
                Outstanding Payments
              </h3>

              <p className="mt-2 text-sm leading-6 text-amber-700">
                You have {pendingPaymentClasses.length}{" "}
                {pendingPaymentClasses.length === 1
                  ? "class"
                  : "classes"}{" "}
                with outstanding payment requirements.
                Online payments are coming soon.
              </p>

              <button
                type="button"
                onClick={() => setFilter("pending-payment")}
                className="mt-3 text-sm font-bold text-amber-800"
              >
                View Outstanding Payments
              </button>
            </div>
          )}

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

              <option value="pending-payment">
                Outstanding payments
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

                const isLive =
                  item.status === "live";

                const isConfirmed =
                  item.enrollment_status === "confirmed";

                const enrollmentPrice =
                  getEnrollmentPrice(item);

                const classPrice =
                  getClassPrice(item);

                const displayPrice =
                  enrollmentPrice ?? classPrice;

                const isFree =
                  displayPrice === 0;

                const hasValidPayment =
                  hasEligiblePayment(item);

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
                  canCancelEnrollment(item);

                // Check whether a cancelled enrolment can be reactivated.
                const canReEnroll =
                  canReactivateEnrollment(item);

                // Identify the enrolment currently being cancelled.
                const isCancelling =
                  cancellingId === item.id;

                const paymentLabel =
                  paymentLabels[item.payment_status] ||
                  "Payment status unavailable";

                const paymentStyle =
                  paymentStyles[item.payment_status] ||
                  "bg-gray-100 text-gray-700";

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

                        <div className="mt-4">
                          <p className="text-xs text-blue-100">
                            {enrollmentPrice === null
                              ? "Current class price"
                              : "Enrolment price"}
                          </p>

                          <p className="mt-1 text-lg font-extrabold">
                            {isFree
                              ? "Free"
                              : displayPrice === null
                                ? "Unavailable"
                                : `${formatCurrency(displayPrice)} CAD`}
                          </p>

                          <p className="mt-1 text-xs text-blue-100">
                            Per student, per session
                          </p>
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

                            {/* Display the current payment status. */}
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${paymentStyle}`}
                            >
                              {paymentLabel}
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
                              {enrollmentPrice === null
                                ? "CURRENT CLASS PRICE"
                                : "ENROLMENT PRICE"}
                            </p>

                            <p className="mt-1 text-sm font-bold">
                              {isFree
                                ? "Free"
                                : displayPrice === null
                                  ? "Unavailable"
                                  : `${formatCurrency(displayPrice)} CAD`}
                            </p>

                            <p className="mt-1 text-xs text-[#64748b]">
                              Per student, per session
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-bold text-[#8190a8]">
                              AMOUNT PAID
                            </p>

                            <p className="mt-1 text-sm font-bold">
                              {item.amount_paid_cents == null
                                ? "Unavailable"
                                : `${formatCurrency(item.amount_paid_cents)}${
                                    formatCurrency(
                                      item.amount_paid_cents
                                    ) === "Unavailable"
                                      ? ""
                                      : " CAD"
                                  }`}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-bold text-[#8190a8]">
                              PAYMENT STATUS
                            </p>

                            <p className="mt-1 text-sm font-bold">
                              {paymentLabel}
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

                          <div>
                            <p className="text-xs font-bold text-[#8190a8]">
                              CURRENCY
                            </p>

                            <p className="mt-1 text-sm font-bold">
                              {item.enrollment_currency ||
                                item.currency ||
                                "CAD"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-bold text-[#8190a8]">
                              CLASS FORMAT
                            </p>

                            <p className="mt-1 text-sm font-bold">
                              Online group session
                            </p>
                          </div>
                        </div>

                        {/* Explain when the original enrolment price is unavailable. */}
                        {enrollmentPrice === null && (
                          <p className="text-xs leading-5 text-[#64748b]">
                            The original enrolment price is not
                            available for this record. The displayed
                            class price is the current listed price.
                          </p>
                        )}

                        {/* Display free enrolment information. */}
                        {!isCancelled &&
                          isFree &&
                          item.payment_status === "not_required" && (
                            <p className="text-xs font-semibold text-green-700">
                              This is a free group class.
                              No payment is required.
                            </p>
                          )}

                        {/* Display paid enrolment information. */}
                        {!isCancelled &&
                          displayPrice > 0 &&
                          item.payment_status === "paid" && (
                            <p className="text-xs font-semibold text-green-700">
                              Your payment has been recorded.
                            </p>
                          )}

                        {/* Display refunded payment information. */}
                        {item.payment_status === "refunded" && (
                          <p className="text-xs font-semibold text-blue-700">
                            This enrolment has been marked as refunded.
                          </p>
                        )}

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
                              Your payment or enrolment details
                              must be verified before joining
                              this classroom.
                            </p>
                          )}

                        {/* Display pending enrolment information. */}
                        {!isCancelled &&
                          item.enrollment_status === "pending" &&
                          item.status !== "completed" && (
                            <p className="text-xs font-semibold text-amber-700">
                              Your enrolment is pending
                              confirmation.
                            </p>
                          )}

                        {/* Display the paid enrolment availability notice. */}
                        {!isCancelled &&
                          displayPrice > 0 &&
                          ["pending", "confirmed"].includes(
                            item.enrollment_status
                          ) &&
                          ["published", "live"].includes(
                            item.status
                          ) &&
                          ["unpaid", "pending", "failed"].includes(
                            item.payment_status
                          ) && (
                            <p className="text-xs font-semibold text-[#26469b]">
                              Online payments are coming soon.
                            </p>
                          )}

                        {/* Display paid cancellation information. */}
                        {!isCancelled &&
                          item.status === "published" &&
                          new Date(item.scheduled_at) > new Date() &&
                          ["pending", "confirmed"].includes(
                            item.enrollment_status
                          ) &&
                          (
                            item.payment_status === "paid" ||
                            item.payment_status === "pending" ||
                            Number(item.amount_paid_cents) > 0
                          ) && (
                            <p className="text-xs leading-5 text-[#64748b]">
                              Enrolments with paid or pending
                              transactions cannot currently be
                              cancelled through this dashboard.
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