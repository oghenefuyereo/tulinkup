// Enable client-side interactions in this component.
"use client";

// Import React hooks to manage form data and calculations.
import { useMemo, useState } from "react";

// Import the router to navigate between pages.
import { useRouter } from "next/navigation";

// Import the icons used in the booking form.
import { Icon } from "./Icons";

// Define the private tutoring pricing rules.
const MAX_HOURLY_RATE_CENTS = 2500;
const VALID_DURATIONS = [30, 60, 90];

// Format Canadian currency.
function formatCurrency(cents) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);
}

// Validate the tutor's hourly rate and convert it to cents.
function getHourlyRateCents(value) {
  if (
    value === null ||
    value === undefined ||
    !["number", "string"].includes(typeof value) ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const hourlyRate = Number(value);

  if (
    !Number.isFinite(hourlyRate) ||
    hourlyRate < 0 ||
    hourlyRate > MAX_HOURLY_RATE_CENTS / 100
  ) {
    return null;
  }

  const cents = Math.round(hourlyRate * 100);

  if (
    Math.abs(hourlyRate * 100 - cents) > 0.000001
  ) {
    return null;
  }

  return cents;
}

// Calculate the estimated price for the selected duration.
function calculateSessionPrice(hourlyRateCents, duration) {
  if (
    hourlyRateCents === null ||
    !VALID_DURATIONS.includes(duration)
  ) {
    return null;
  }

  return Math.round(
    (hourlyRateCents * duration) / 60
  );
}

// Format a date into a readable format for students.
function formatDate(dateString, options) {
  // Return an empty value if no date is provided.
  if (!dateString) return "";

  // Create a date object using the selected date.
  const date = new Date(
    `${dateString.slice(0, 10)}T12:00:00`
  );

  // Return the original value if the date is invalid.
  if (Number.isNaN(date.getTime())) return dateString;

  // Format the date using Canadian English settings.
  return date.toLocaleDateString("en-CA", options);
}

// Convert a time value into minutes.
function toMinutes(value) {
  const [hours, minutes] = String(value)
    .split(":")
    .map(Number);

  return hours * 60 + minutes;
}

// Prepare availability slots in a consistent format.
function normalizeSlots(slots) {
  return (Array.isArray(slots) ? slots : [])
    // Convert each slot into the format used by the booking form.
    .map((slot) => ({
      id: String(slot.id ?? ""),
      date: String(
        slot.date ?? slot.available_date ?? ""
      ).slice(0, 10),
      startTime: String(
        slot.startTime ?? slot.start_time ?? ""
      ).slice(0, 5),
      endTime: String(
        slot.endTime ?? slot.end_time ?? ""
      ).slice(0, 5),
    }))
    // Remove slots that are missing required information.
    .filter(
      (slot) =>
        slot.id &&
        slot.date &&
        slot.startTime &&
        slot.endTime
    )
    // Sort the available slots by date and start time.
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.startTime.localeCompare(b.startTime)
    );
}

// Create the booking form used by students to request tutoring sessions.
export function BookingForm({ tutor, slots = [] }) {
  // Initialize the router for navigation after booking.
  const router = useRouter();

  // Prepare the tutor's available time slots.
  const normalizedSlots = useMemo(
    () => normalizeSlots(slots),
    [slots]
  );

  // Prepare the subjects offered by the selected tutor.
  const subjects = useMemo(() => {
    // Use the tutor's subject list if one is available.
    if (Array.isArray(tutor.subjects)) {
      return tutor.subjects.map((subject) =>
        typeof subject === "string"
          ? { id: subject, name: subject }
          : subject
      );
    }

    // Convert a comma-separated subject list into individual options.
    return String(tutor.subject || "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ id: name, name }));
  }, [tutor]);

  // Get the unique dates when the tutor is available.
  const dates = useMemo(
    () => [
      ...new Set(
        normalizedSlots.map((slot) => slot.date)
      ),
    ],
    [normalizedSlots]
  );

  // Store the date selected by the student.
  const [selectedDate, setSelectedDate] = useState(
    dates[0] || ""
  );

  // Store the selected availability slot.
  const [slotID, setSlotID] = useState(
    normalizedSlots[0]?.id || ""
  );

  // Store the subject selected for the tutoring session.
  const [subjectID, setSubjectID] = useState(
    subjects[0]?.id || ""
  );

  // Store the session duration and optional learning notes.
  const [duration, setDuration] = useState("60");
  const [note, setNote] = useState("");

  // Track booking progress, errors, and successful submissions.
  const [state, setState] = useState({
    loading: false,
    error: "",
    success: false,
  });

  // Find the available time slots for the selected date.
  const available = useMemo(
    () =>
      normalizedSlots.filter(
        (slot) => slot.date === selectedDate
      ),
    [normalizedSlots, selectedDate]
  );

  // Find the specific time slot selected by the student.
  const selectedSlot = normalizedSlots.find(
    (slot) =>
      slot.id === slotID &&
      slot.date === selectedDate
  );

  // Retrieve and validate the tutor's hourly teaching rate.
  const hourlyRateCents = getHourlyRateCents(
    tutor.hourlyRate ?? tutor.hourly_rate
  );

  // Convert the selected duration into minutes.
  const durationMinutes = Number(duration);

  // Calculate the estimated session cost in cents.
  const totalPriceCents = calculateSessionPrice(
    hourlyRateCents,
    durationMinutes
  );

  // Check whether the tutor has valid pricing information.
  const hasValidPricing =
    hourlyRateCents !== null &&
    totalPriceCents !== null;

  // Identify free sessions and sessions requiring payment.
  const isFree =
    hasValidPricing && totalPriceCents === 0;

  const requiresPayment =
    hasValidPricing && totalPriceCents > 0;

  // Check whether the selected session fits the available time slot.
  const slotFitsDuration =
    Boolean(selectedSlot) &&
    VALID_DURATIONS.includes(durationMinutes) &&
    toMinutes(selectedSlot.startTime) +
      durationMinutes <=
      toMinutes(selectedSlot.endTime);

  // Check whether the student can submit the booking.
  const canSubmit =
    !state.loading &&
    Boolean(selectedSlot) &&
    Boolean(subjectID) &&
    hasValidPricing &&
    slotFitsDuration &&
    !requiresPayment;

  // Clear previous errors when booking details change.
  function clearError() {
    setState((previous) => ({
      ...previous,
      error: "",
    }));
  }

  // Update the selected date and choose its first available time slot.
  function selectDate(date) {
    setSelectedDate(date);

    // Find the first available slot for the selected date.
    const firstSlot = normalizedSlots.find(
      (slot) => slot.date === date
    );

    // Update the selected time and clear previous errors.
    setSlotID(firstSlot?.id || "");
    clearError();
  }

  // Handle the submission of a tutoring session request.
  async function submit() {
    // Prevent another request while a booking is being submitted.
    if (state.loading || state.success) return;

    // Make sure the student has selected an available time.
    if (!selectedSlot) {
      setState({
        loading: false,
        error: "Choose an available time.",
        success: false,
      });
      return;
    }

    // Make sure the student has selected a subject.
    if (!subjectID) {
      setState({
        loading: false,
        error: "Choose a subject.",
        success: false,
      });
      return;
    }

    // Make sure the student selected a supported duration.
    if (!VALID_DURATIONS.includes(durationMinutes)) {
      setState({
        loading: false,
        error: "Choose a valid session duration.",
        success: false,
      });
      return;
    }

    // Prevent bookings when the tutor's pricing is invalid.
    if (!hasValidPricing) {
      setState({
        loading: false,
        error:
          "This tutor has not configured a valid hourly rate.",
        success: false,
      });
      return;
    }

    // Prevent paid bookings until payment integration is available.
    if (requiresPayment) {
      setState({
        loading: false,
        error:
          "Paid tutoring bookings are not available yet.",
        success: false,
      });
      return;
    }

    // Make sure the session fits within the tutor's available time.
    if (!slotFitsDuration) {
      setState({
        loading: false,
        error:
          "The selected time slot is too short for this session duration.",
        success: false,
      });
      return;
    }

    // Show the loading state while submitting the booking.
    setState({
      loading: true,
      error: "",
      success: false,
    });

    try {
      // Send the booking information to the API.
      // The backend calculates the final price from the tutor's stored rate.
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tutorID: tutor.id,
          slotID: selectedSlot.id,
          subjectID,
          date: selectedSlot.date,
          startTime: selectedSlot.startTime,
          duration: durationMinutes,
          note: note.trim(),
        }),
      });

      // Redirect users to login if they are not authenticated.
      if (response.status === 401) {
        const nextPath = `/tutors/${encodeURIComponent(
          tutor.slug
        )}/book`;

        setState({
          loading: false,
          error: "",
          success: false,
        });

        router.push(
          `/login?next=${encodeURIComponent(nextPath)}`
        );
        return;
      }

      // Read the response and handle missing JSON safely.
      const data = await response.json().catch(() => ({}));

      // Display an error if the booking request fails.
      if (!response.ok || data.success === false) {
        throw new Error(
          data.error ||
            data.message ||
            "Unable to submit your booking request."
        );
      }

      // Mark the booking request as successfully submitted.
      setState({
        loading: false,
        error: "",
        success: true,
      });
    } catch (error) {
      // Display an error if something goes wrong.
      setState({
        loading: false,
        error:
          error.message ||
          "Something went wrong. Please try again.",
        success: false,
      });
    }
  }

  // Display a confirmation message after a successful booking request.
  if (state.success) {
    return (
      <div className="panel p-8 text-center">
        {/* Display a success icon. */}
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#e7f7ed] text-[#149451]">
          <Icon
            name="check"
            className="h-8 w-8"
          />
        </span>

        <h2 className="mt-5 text-2xl font-extrabold">
          Request sent
        </h2>

        {/* Explain that the booking is waiting for tutor approval. */}
        <p className="mx-auto mt-3 max-w-md text-[#68758c]">
          Your session with {tutor.name} is pending approval.
          You can track it from your student dashboard.
        </p>

        {/* Confirm that no payment was required. */}
        <p className="mt-4 text-sm font-semibold text-green-700">
          This is a free tutoring session.
          No payment was required.
        </p>

        {/* Allow students to view their submitted bookings. */}
        <button
          type="button"
          onClick={() =>
            router.push("/dashboard/student")
          }
          className="btn-primary mt-7"
        >
          View my bookings
        </button>
      </div>
    );
  }

  // Display the booking form and session summary.
  return (
    <div className="grid gap-7 lg:grid-cols-[1fr_360px]">
      {/* Display the main booking options. */}
      <section className="panel p-6 sm:p-8">
        <div>
          <label className="form-label">
            1. Choose a date
          </label>

          {/* Show the dates when the tutor is available. */}
          {dates.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {dates.map((item) => (
                <button
                  type="button"
                  key={item}
                  disabled={state.loading}
                  aria-pressed={selectedDate === item}
                  onClick={() => selectDate(item)}
                  className={`rounded-xl border p-3 text-left transition ${
                    selectedDate === item
                      ? "border-[#26469b] bg-[#edf1fa]"
                      : "border-[#e0e5ee]"
                  }`}
                >
                  {/* Display the weekday. */}
                  <span className="block text-xs font-bold uppercase text-[#7c879a]">
                    {formatDate(item, {
                      weekday: "short",
                    })}
                  </span>

                  {/* Display the month and day. */}
                  <span className="mt-1 block font-extrabold">
                    {formatDate(item, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            // Show a message when the tutor has no available dates.
            <p className="rounded-xl bg-[#fff8dc] p-4 text-sm text-[#725b00]">
              This tutor has not published any available
              booking times yet.
            </p>
          )}
        </div>

        {/* Allow students to select an available time. */}
        <div className="mt-7">
          <label className="form-label">
            2. Select a time
          </label>

          <div className="flex flex-wrap gap-3">
            {available.map((slot) => (
              <button
                type="button"
                key={slot.id}
                disabled={state.loading}
                aria-pressed={slotID === slot.id}
                onClick={() => {
                  setSlotID(slot.id);
                  clearError();
                }}
                className={`rounded-xl border px-4 py-3 text-sm font-bold ${
                  slotID === slot.id
                    ? "border-[#26469b] bg-[#26469b] text-white"
                    : "border-[#dce2ec] bg-white text-[#32415e]"
                }`}
              >
                {slot.startTime}
              </button>
            ))}
          </div>
        </div>

        {/* Allow students to choose a subject and session duration. */}
        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <label>
            <span className="form-label">
              3. Subject
            </span>

            {/* Display the subjects offered by the tutor. */}
            <select
              value={subjectID}
              disabled={state.loading}
              onChange={(event) => {
                setSubjectID(event.target.value);
                clearError();
              }}
              className="form-input bg-white"
            >
              {subjects.map((subject) => (
                <option
                  key={subject.id}
                  value={subject.id}
                >
                  {subject.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="form-label">
              4. Session duration
            </span>

            {/* Allow students to select the length of the session. */}
            <select
              value={duration}
              disabled={state.loading}
              onChange={(event) => {
                setDuration(event.target.value);
                clearError();
              }}
              className="form-input bg-white"
            >
              {VALID_DURATIONS.map((minutes) => (
                <option
                  key={minutes}
                  value={minutes}
                >
                  {minutes} minutes
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Notify students when the selected duration exceeds the slot. */}
        {selectedSlot && !slotFitsDuration && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-700"
          >
            The selected time slot is too short for this
            session duration. Choose a shorter session
            or another available time.
          </p>
        )}

        {/* Allow students to describe what they want to learn. */}
        <label className="mt-6 block">
          <span className="form-label">
            What would you like help with?{" "}
            <span className="font-normal text-[#8993a5]">
              (optional)
            </span>
          </span>

          <textarea
            value={note}
            maxLength={500}
            disabled={state.loading}
            onChange={(event) =>
              setNote(event.target.value)
            }
            className="min-h-28 w-full rounded-xl border border-[#dce2ec] bg-[#f9fafc] p-4 text-sm"
            placeholder="Share your learning goal or a topic to prepare..."
          />
        </label>

        {/* Display an error message if the booking cannot be submitted. */}
        {state.error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700"
          >
            {state.error}
          </p>
        )}
      </section>

      {/* Display the selected session details and estimated cost. */}
      <aside className="panel h-fit p-6 lg:sticky lg:top-24">
        <h2 className="text-lg font-extrabold">
          Booking summary
        </h2>

        <div className="mt-5 space-y-4 text-sm">
          {/* Display the selected tutor's name. */}
          <Row
            label="Tutor"
            value={tutor.name}
          />

          {/* Display the type of tutoring session. */}
          <Row
            label="Session type"
            value="One-on-one tutoring"
          />

          {/* Display the tutor's hourly rate. */}
          <Row
            label="Hourly rate"
            value={
              hourlyRateCents === null
                ? "Unavailable"
                : hourlyRateCents === 0
                  ? "Free"
                  : `${formatCurrency(hourlyRateCents)}/hr`
            }
          />

          {/* Display the selected session duration. */}
          <Row
            label="Duration"
            value={`${duration} minutes`}
          />

          {/* Display the number of students allowed. */}
          <Row
            label="Students"
            value="1 student"
          />

          {/* Display the selected session date. */}
          {selectedSlot && (
            <Row
              label="Date"
              value={formatDate(selectedSlot.date, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            />
          )}

          {/* Display the selected session start time. */}
          {selectedSlot && (
            <Row
              label="Start time"
              value={selectedSlot.startTime}
            />
          )}

          {/* Display the booking currency. */}
          <Row
            label="Currency"
            value="CAD"
          />

          {/* Display the estimated session cost. */}
          <div className="border-t border-[#edf0f5] pt-4">
            <Row
              label="Session estimate"
              value={
                totalPriceCents === null
                  ? "Unavailable"
                  : formatCurrency(totalPriceCents)
              }
              strong
            />
          </div>

          <p className="text-xs leading-5 text-[#748096]">
            The session price is calculated using the
            tutor&apos;s hourly rate and the selected
            duration.
          </p>
        </div>

        {/* Explain that free sessions do not require payment. */}
        {isFree && (
          <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-xs leading-5 text-green-700">
            <p className="font-bold">
              Free tutoring session
            </p>

            <p className="mt-1">
              No payment is required. Submit your
              booking request and wait for the tutor
              to approve it.
            </p>
          </div>
        )}

        {/* Explain that paid bookings are not available yet. */}
        {requiresPayment && (
          <div className="mt-6 rounded-xl bg-[#fff8dc] p-4 text-xs leading-5 text-[#725b00]">
            <p className="font-bold">
              Online payments coming soon
            </p>

            <p className="mt-1">
              Paid tutoring bookings are temporarily
              unavailable. You can explore tutors
              offering free sessions.
            </p>
          </div>
        )}

        {/* Display a warning when the tutor's pricing is unavailable. */}
        {!hasValidPricing && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-xs leading-5 text-red-700"
          >
            This tutor has not configured a valid
            hourly rate. Booking is currently
            unavailable.
          </div>
        )}

        {/* Submit the booking request when all requirements are satisfied. */}
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="btn-primary mt-5 w-full py-4 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state.loading
            ? "Submitting…"
            : !hasValidPricing
              ? "Booking unavailable"
              : requiresPayment
                ? "Paid booking coming soon"
                : "Submit booking request"}
        </button>
      </aside>
    </div>
  );
}

// Create a reusable row for displaying booking summary information.
function Row({ label, value, strong = false }) {
  return (
    <div className="flex items-center justify-between gap-4">
      {/* Display the summary label. */}
      <span className="text-[#748096]">
        {label}
      </span>

      {/* Display the value with optional emphasis. */}
      <span
        className={
          strong
            ? "text-lg font-extrabold text-[#173472]"
            : "font-bold text-[#26334f]"
        }
      >
        {value}
      </span>
    </div>
  );
}