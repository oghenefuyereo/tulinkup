
// Enable client-side interactions in this component.
"use client";

// Import React hooks to manage form data and calculations.
import { useMemo, useState } from "react";

// Import the router to navigate between pages.
import { useRouter } from "next/navigation";

// Import the icons used in the booking form.
import { Icon } from "./Icons";

// Format a date into a readable format for students.
function formatDate(dateString, options) {
  // Return an empty value if no date is provided.
  if (!dateString) return "";

  // Create a date object using the selected date.
  const date = new Date(`${dateString.slice(0, 10)}T12:00:00`);

  // Return the original value if the date is invalid.
  if (Number.isNaN(date.getTime())) return dateString;

  // Format the date using Canadian English settings.
  return date.toLocaleDateString("en-CA", options);
}

// Prepare availability slots in a consistent format.
function normalizeSlots(slots) {
  return (Array.isArray(slots) ? slots : [])
    // Convert each slot into the format used by the booking form.
    .map((slot) => ({
      id: String(slot.id ?? ""),
      date: String(slot.date ?? slot.available_date ?? "").slice(0, 10),
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
      ...new Set(normalizedSlots.map((slot) => slot.date)),
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

  // Get the tutor's hourly teaching rate.
  const hourlyRate = Number(
    tutor.hourlyRate ?? tutor.hourly_rate ?? 0
  );

  // Calculate the estimated session cost based on duration.
  const total = hourlyRate * (Number(duration) / 60);

  // Update the selected date and choose its first available time slot.
  function selectDate(date) {
    setSelectedDate(date);

    // Find the first available slot for the selected date.
    const firstSlot = normalizedSlots.find(
      (slot) => slot.date === date
    );

    // Update the selected time and clear previous errors.
    setSlotID(firstSlot?.id || "");
    setState((previous) => ({
      ...previous,
      error: "",
    }));
  }

  // Handle the submission of a tutoring session request.
  async function submit() {
    // Prevent another request while a booking is being submitted.
    if (state.loading) return;

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

    // Convert the selected session duration into minutes.
    const durationMinutes = Number(duration);

    // Convert the start time into minutes for comparison.
    const startMinutes =
      Number(selectedSlot.startTime.split(":")[0]) * 60 +
      Number(selectedSlot.startTime.split(":")[1]);

    // Convert the end time into minutes for comparison.
    const endMinutes =
      Number(selectedSlot.endTime.split(":")[0]) * 60 +
      Number(selectedSlot.endTime.split(":")[1]);

    // Make sure the session fits within the tutor's available time.
    if (startMinutes + durationMinutes > endMinutes) {
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

        router.push(
          `/login?next=${encodeURIComponent(nextPath)}`
        );
        return;
      }

      // Read the response and handle missing JSON safely.
      const data = await response.json().catch(() => ({}));

      // Display an error if the booking request fails.
      if (!response.ok) {
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

        {/* Allow students to view their submitted bookings. */}
        <button
          type="button"
          onClick={() => router.push("/dashboard/student")}
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
                onClick={() => setSlotID(slot.id)}
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
              onChange={(event) =>
                setSubjectID(event.target.value)
              }
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
              onChange={(event) =>
                setDuration(event.target.value)
              }
              className="form-input bg-white"
            >
              <option value="30">30 minutes</option>
              <option value="60">60 minutes</option>
              <option value="90">90 minutes</option>
            </select>
          </label>
        </div>

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

          {/* Display the tutor's hourly rate. */}
          <Row
            label="Hourly rate"
            value={`$${hourlyRate.toFixed(2)}`}
          />

          {/* Display the selected session duration. */}
          <Row
            label="Duration"
            value={`${duration} minutes`}
          />

          {/* Display the estimated session cost. */}
          <Row
            label="Session estimate"
            value={`$${total.toFixed(2)}`}
            strong
          />
        </div>

        {/* Explain that payments are not collected in the current MVP. */}
        <div className="mt-6 rounded-xl bg-[#fff8dc] p-4 text-xs leading-5 text-[#725b00]">
          This MVP submits a booking request only.
          No payment will be taken.
        </div>

        {/* Submit the booking request when all required options are selected. */}
        <button
          type="button"
          onClick={submit}
          disabled={
            state.loading ||
            !selectedSlot ||
            !subjectID
          }
          className="btn-primary mt-5 w-full py-4 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state.loading
            ? "Submitting…"
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
