// Enable client-side interactions.
"use client";

// Import required components and hooks.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "./Icons";
import { ProfileAvatar } from "./UserAvatar";
import MessageTutorButton from "./messaging/MessageTutorButton";

// Define the payment statuses supported by the platform.
const paymentLabels = {
  unpaid: "Unpaid",
  pending: "Payment pending",
  paid: "Paid",
  failed: "Payment failed",
  refunded: "Refunded",
  not_required: "Free session",
};

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

// Format stored monetary amounts in Canadian dollars.
function formatCurrency(amountCents) {
  if (
    !Number.isSafeInteger(amountCents) ||
    amountCents < 0
  ) {
    return "Unavailable";
  }

  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(amountCents / 100);
}

// Get the stored pricing information for a booking.
function getBookingPricing(booking) {
  return {
    hourlyRateCents:
      booking.hourlyRateCents ??
      booking.hourly_rate_cents ??
      null,

    totalPriceCents:
      booking.totalPriceCents ??
      booking.total_price_cents ??
      null,

    platformCommissionCents:
      booking.platformCommissionCents ??
      booking.platform_commission_cents ??
      null,

    tutorEarningsCents:
      booking.tutorEarningsCents ??
      booking.tutor_earnings_cents ??
      null,

    currency: booking.currency ?? null,

    paymentStatus:
      booking.paymentStatus ??
      booking.payment_status ??
      null,
  };
}

// Check whether the booking has valid stored pricing.
function hasValidPricing(pricing, duration) {
  const {
    hourlyRateCents,
    totalPriceCents,
    currency,
    paymentStatus,
  } = pricing;

  const durationMinutes = Number(duration);

  if (
    !Number.isSafeInteger(hourlyRateCents) ||
    hourlyRateCents < 0 ||
    hourlyRateCents > 2500 ||
    !Number.isSafeInteger(totalPriceCents) ||
    totalPriceCents < 0 ||
    currency !== "CAD" ||
    ![30, 60, 90].includes(durationMinutes)
  ) {
    return false;
  }

  // Make sure the stored session price matches the booked duration.
  const expectedPrice = Math.round(
    (hourlyRateCents * durationMinutes) / 60
  );

  if (totalPriceCents !== expectedPrice) {
    return false;
  }

  // Make sure the payment status is recognized.
  if (!Object.hasOwn(paymentLabels, paymentStatus)) {
    return false;
  }

  // Free sessions must not require payment.
  if (totalPriceCents === 0) {
    return paymentStatus === "not_required";
  }

  return paymentStatus !== "not_required";
}

// Check whether the stored revenue breakdown is valid.
function hasValidRevenueSplit(pricing) {
  const {
    totalPriceCents,
    platformCommissionCents,
    tutorEarningsCents,
  } = pricing;

  return (
    Number.isSafeInteger(platformCommissionCents) &&
    platformCommissionCents >= 0 &&
    Number.isSafeInteger(tutorEarningsCents) &&
    tutorEarningsCents >= 0 &&
    platformCommissionCents + tutorEarningsCents ===
      totalPriceCents
  );
}

// Check whether the session meets its payment requirement.
function hasEligiblePayment(pricing, validPricing) {
  if (!validPricing) return false;

  if (pricing.totalPriceCents === 0) {
    return pricing.paymentStatus === "not_required";
  }

  return pricing.paymentStatus === "paid";
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

    // Find the booking being updated.
    const booking = bookings.find(
      (item) => String(item.id) === String(id)
    );

    if (!booking) {
      setError("Booking not found.");
      return;
    }

    // Get the booking's stored pricing and payment information.
    const pricing = getBookingPricing(booking);

    const duration =
      booking.duration ??
      booking.duration_minutes ??
      60;

    const validPricing = hasValidPricing(
      pricing,
      duration
    );

    const eligiblePayment = hasEligiblePayment(
      pricing,
      validPricing
    );

    // Prevent accepting sessions that do not meet payment requirements.
    if (
      status === "accepted" &&
      !eligiblePayment
    ) {
      setError(
        "This booking cannot be accepted until its payment requirements are satisfied."
      );

      return;
    }

    // Prevent completing unpaid or unverified sessions.
    if (
      status === "completed" &&
      !eligiblePayment
    ) {
      setError(
        "This session cannot be completed until its payment requirements are satisfied."
      );

      return;
    }

    // Prevent direct cancellation or decline of bookings with active payments.
    if (
      ["cancelled", "declined"].includes(status) &&
      ["paid", "pending"].includes(
        pricing.paymentStatus
      )
    ) {
      setError(
        "This booking requires payment or refund review before its status can be changed."
      );

      return;
    }

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

        // Refresh because the backend may have processed the request.
        if (response.status >= 500) {
          router.refresh();
        }

        return;
      }

      // Handle invalid or unexpected responses.
      if (
        !data ||
        data.success !== true ||
        !data.booking ||
        String(data.booking.id) !== String(id) ||
        data.booking.status !== status
      ) {
        setError(
          data?.error ||
            data?.message ||
            "Unable to confirm the booking update. Refresh your dashboard."
        );

        router.refresh();

        return;
      }

      // Refresh the dashboard to display the updated booking.
      router.refresh();
    } catch (err) {
      // Log unexpected errors.
      console.error("Booking update failed:", err);

      setError(
        "Unable to confirm the booking update. Refresh your dashboard before trying again."
      );

      router.refresh();
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

        // Determine the other booking participant.
        const participantName =
          role === "student" ? tutorName : studentName;

        const participantInitials = String(participantName)
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => Array.from(part)[0])
          .join("")
          .toUpperCase();

        const tutorSlug =
          typeof booking.tutorSlug === "string"
            ? booking.tutorSlug
            : "";

        const tutorProfileHref =
          role === "student" &&
          booking.tutorProfileAvailable === true &&
          /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(tutorSlug)
            ? `/tutors/${encodeURIComponent(tutorSlug)}`
            : null;

        const tutorUserId = String(booking.tutorId ?? "");

        const canMessageTutor =
          role === "student" &&
          booking.tutorProfileAvailable === true &&
          /^[1-9]\d{0,18}$/.test(tutorUserId) &&
          BigInt(tutorUserId) <= 9223372036854775807n;

        const participantAvatar = (
          <ProfileAvatar
            imageUrl={
              role === "student" &&
              booking.tutorProfileAvailable === true
                ? booking.tutorProfileImageUrl
                : null
            }
            initials={participantInitials}
            size={52}
          />
        );

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

        // Get the stored pricing information.
        const pricing = getBookingPricing(booking);

        const validPricing = hasValidPricing(
          pricing,
          duration
        );

        const validRevenueSplit =
          validPricing &&
          hasValidRevenueSplit(pricing);

        // Check whether the session meets its payment requirement.
        const eligiblePayment = hasEligiblePayment(
          pricing,
          validPricing
        );

        // Allow eligible participants to open the existing classroom.
        const classroomHref =
          ["student", "tutor"].includes(role) &&
          booking.status === "accepted" &&
          eligiblePayment &&
          /^[1-9]\d*$/.test(bookingId)
            ? `/classroom/one_on_one/${bookingId}`
            : null;

        // Check whether payment or refund review is required.
        const requiresPaymentReview = [
          "paid",
          "pending",
        ].includes(pricing.paymentStatus);

        // Check whether the booking is still active.
        const isActiveBooking = [
          "pending",
          "accepted",
        ].includes(booking.status);

        // Check whether the tutor can accept this booking.
        const canAccept =
          booking.status === "pending" &&
          eligiblePayment;

        // Check whether the tutor can complete this booking.
        const canComplete =
          booking.status === "accepted" &&
          eligiblePayment;

        return (
          <article
            key={bookingId}
            className="panel flex min-w-0 flex-col gap-4 p-4 sm:p-5"
          >
            {/* Participant header. */}
            <div className="flex min-w-0 items-start gap-3">
              {tutorProfileHref ? (
                <Link
                  href={tutorProfileHref}
                  prefetch={false}
                  aria-label={`View ${tutorName}'s profile`}
                  className="inline-flex shrink-0 rounded-full"
                >
                  {participantAvatar}
                </Link>
              ) : (
                <div className="shrink-0">
                  {participantAvatar}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <h3 className="break-words text-base font-extrabold">
                  {tutorProfileHref ? (
                    <Link
                      href={tutorProfileHref}
                      prefetch={false}
                      className="text-[#26469b] hover:underline"
                    >
                      {participantName}
                    </Link>
                  ) : (
                    participantName
                  )}
                </h3>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Status value={booking.status} />

                  <PaymentStatus
                    value={pricing.paymentStatus}
                    valid={validPricing}
                  />
                </div>
              </div>
            </div>

            {/* Booking details. */}
            <div className="min-w-0">
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

              {/* Display the original session pricing. */}
              {validPricing ? (
                <div className="mt-4 rounded-xl border border-[#e0e5ee] bg-[#f9fafc] p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-[#71809a]">
                        Hourly rate
                      </p>

                      <p className="mt-1 text-sm font-bold text-[#26334f]">
                        {formatCurrency(
                          pricing.hourlyRateCents
                        )}{" "}
                        CAD
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-[#71809a]">
                        Session price
                      </p>

                      <p className="mt-1 text-sm font-extrabold text-[#173472]">
                        {pricing.totalPriceCents === 0
                          ? "Free"
                          : `${formatCurrency(
                              pricing.totalPriceCents
                            )} CAD`}
                      </p>
                    </div>

                    {/* Display the revenue breakdown only to tutors. */}
                    {role === "tutor" &&
                      validRevenueSplit && (
                        <>
                          <div>
                            <p className="text-xs text-[#71809a]">
                              Estimated tutor earnings (80%)
                            </p>

                            <p className="mt-1 text-sm font-extrabold text-green-700">
                              {formatCurrency(
                                pricing.tutorEarningsCents
                              )}{" "}
                              CAD
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-[#71809a]">
                              Platform commission (20%)
                            </p>

                            <p className="mt-1 text-sm font-bold text-[#26334f]">
                              {formatCurrency(
                                pricing.platformCommissionCents
                              )}{" "}
                              CAD
                            </p>
                          </div>
                        </>
                      )}
                  </div>

                  {/* Explain that the stored price remains unchanged. */}
                  <p className="mt-3 text-xs leading-5 text-[#7c879a]">
                    Pricing is based on the rate stored
                    when this booking was created.
                  </p>

                  {/* Explain that estimated earnings are not payouts. */}
                  {role === "tutor" &&
                    validRevenueSplit && (
                      <p className="mt-1 text-xs leading-5 text-[#7c879a]">
                        Revenue breakdown before applicable
                        fees and taxes. These amounts do
                        not represent confirmed earnings
                        or completed payouts.
                      </p>
                    )}

                  {/* Handle unavailable tutor revenue information. */}
                  {role === "tutor" &&
                    !validRevenueSplit && (
                      <p className="mt-2 text-xs text-amber-700">
                        The revenue breakdown could not be
                        verified.
                      </p>
                    )}
                </div>
              ) : (
                // Keep historical bookings without pricing information.
                <p className="mt-3 rounded-xl bg-[#fff8dc] p-3 text-xs leading-5 text-[#725b00]">
                  Pricing information is unavailable or
                  could not be verified for this booking.
                </p>
              )}

              {/* Explain that free sessions do not require payment. */}
              {validPricing &&
                pricing.totalPriceCents === 0 &&
                isActiveBooking && (
                  <p className="mt-3 text-xs font-semibold text-green-700">
                    No payment is required for this session.
                  </p>
                )}

              {/* Explain that paid bookings require payment verification. */}
              {validPricing &&
                pricing.totalPriceCents > 0 &&
                !eligiblePayment &&
                isActiveBooking && (
                  <p className="mt-3 rounded-xl bg-[#fff8dc] p-3 text-xs leading-5 text-[#725b00]">
                    {requiresPaymentReview
                      ? "Payment is awaiting verification."
                      : "This session requires a verified payment. Online payments will become available after payment integration."}
                  </p>
                )}

              {/* Display a message when payment has been verified. */}
              {validPricing &&
                pricing.paymentStatus === "paid" &&
                isActiveBooking && (
                  <p className="mt-3 text-xs font-semibold text-green-700">
                    Payment verified.
                  </p>
                )}

              {/* Display a notice for bookings requiring refund review. */}
              {requiresPaymentReview &&
                isActiveBooking && (
                  <p className="mt-2 text-xs text-[#64748b]">
                    Payment or refund review is required
                    before cancelling this booking.
                  </p>
                )}

              {/* Display a message for refunded bookings. */}
              {pricing.paymentStatus === "refunded" && (
                <p className="mt-3 text-xs text-[#64748b]">
                  The payment for this booking has been
                  refunded.
                </p>
              )}

              {/* Student-to-tutor profile and messaging actions. */}
              {(tutorProfileHref || canMessageTutor) && (
                <div
                  className={`mt-4 grid items-start gap-2 ${
                    tutorProfileHref && canMessageTutor
                      ? "grid-cols-2"
                      : "grid-cols-1"
                  }`}
                >
                  {tutorProfileHref && (
                    <Link
                      href={tutorProfileHref}
                      prefetch={false}
                      className="btn-secondary flex w-full min-w-0 items-center justify-center gap-2 py-4 text-center"
                    >
                      <Icon
                        name="user"
                        className="h-5 w-5 shrink-0"
                      />
                      View profile
                    </Link>
                  )}

                  {canMessageTutor && (
                    <MessageTutorButton
                      tutorUserId={tutorUserId}
                      wrapperClassName="min-w-0 w-full"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Display actions based on role and status. */}
            <div className="flex min-w-0 flex-col gap-2">
              {/* Open the authorized one-on-one classroom. */}
              {["student", "tutor"].includes(role) &&
                booking.status === "accepted" && (
                  classroomHref ? (
                    <Link
                      href={classroomHref}
                      prefetch={false}
                      className="inline-flex w-full items-center justify-center rounded-xl bg-[#26469b] px-4 py-4 text-sm font-bold text-white transition hover:bg-[#173472]"
                    >
                      {role === "tutor"
                        ? "Start Live Session"
                        : "Join Live Session"}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      title="Classroom eligibility requirements are not satisfied"
                      className="w-full cursor-not-allowed rounded-xl bg-[#26469b] px-4 py-4 text-sm font-bold text-white opacity-50"
                    >
                      {role === "tutor"
                        ? "Start Live Session"
                        : "Join Live Session"}
                    </button>
                  )
                )}

              {/* Display the live classroom integration notice. */}
              {["tutor", "student"].includes(role) &&
                booking.status === "accepted" && (
                  <p className="text-center text-xs leading-5 text-[#64748b]">
                    {classroomHref
                      ? "Open the classroom to check session availability."
                      : eligiblePayment
                        ? "Classroom access is unavailable for this booking."
                        : "Live session access requires valid pricing and payment verification."}
                  </p>
                )}

              {/* Allow tutors to accept or decline pending bookings. */}
              {role === "tutor" &&
                booking.status === "pending" && (
                  <>
                    {/* Accept bookings that meet payment requirements. */}
                    <button
                      type="button"
                      disabled={
                        Boolean(busy) || !canAccept
                      }
                      title={
                        canAccept
                          ? "Accept booking"
                          : "Valid pricing and payment verification are required"
                      }
                      onClick={() =>
                        update(bookingId, "accepted")
                      }
                      className="btn-primary px-4 py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy === `${bookingId}-accepted`
                        ? "Accepting..."
                        : "Accept"}
                    </button>

                    {/* Decline bookings without active payments. */}
                    <button
                      type="button"
                      disabled={
                        Boolean(busy) ||
                        requiresPaymentReview
                      }
                      title={
                        requiresPaymentReview
                          ? "Payment or refund review is required"
                          : "Decline booking"
                      }
                      onClick={() =>
                        update(bookingId, "declined")
                      }
                      className="btn-secondary px-4 py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy === `${bookingId}-declined`
                        ? "Declining..."
                        : "Decline"}
                    </button>
                  </>
                )}

              {/* Allow tutors to complete eligible accepted bookings. */}
              {role === "tutor" &&
                booking.status === "accepted" && (
                  <button
                    type="button"
                    disabled={
                      Boolean(busy) || !canComplete
                    }
                    title={
                      canComplete
                        ? "Mark session as completed"
                        : "Payment verification is required"
                    }
                    onClick={() =>
                      update(bookingId, "completed")
                    }
                    className="btn-primary px-4 py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy === `${bookingId}-completed`
                      ? "Updating..."
                      : "Mark completed"}
                  </button>
                )}

              {/* Allow students to cancel eligible bookings. */}
              {role === "student" &&
                ["pending", "accepted"].includes(
                  booking.status
                ) && (
                  <button
                    type="button"
                    disabled={
                      Boolean(busy) ||
                      requiresPaymentReview
                    }
                    title={
                      requiresPaymentReview
                        ? "Payment or refund review is required"
                        : "Cancel booking"
                    }
                    onClick={() =>
                      update(bookingId, "cancelled")
                    }
                    className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-[#64748b] hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy === `${bookingId}-cancelled`
                      ? "Cancelling..."
                      : "Cancel booking"}
                  </button>
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

// Create a reusable payment status badge.
function PaymentStatus({ value, valid }) {
  // Select the badge colour based on the payment status.
  const color = !valid
    ? "bg-slate-100 text-slate-600"
    : value === "paid" ||
        value === "not_required"
      ? "bg-green-50 text-green-700"
      : value === "pending" ||
          value === "unpaid"
        ? "bg-amber-50 text-amber-700"
        : value === "failed"
          ? "bg-red-50 text-red-700"
          : value === "refunded"
            ? "bg-blue-50 text-blue-700"
            : "bg-slate-100 text-slate-600";

  // Display the payment status separately from the booking status.
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${color}`}
    >
      {valid
        ? paymentLabels[value] || "Payment unavailable"
        : "Payment unavailable"}
    </span>
  );
}