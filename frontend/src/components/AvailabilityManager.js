
// Enable client-side interactions in this component.
"use client";

// Import the router to refresh the page after changes.
import { useRouter } from "next/navigation";

// Import useState to manage loading, errors, and success messages.
import { useState } from "react";

// Create a calendar icon for displaying available time slots.
function CalendarIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  );
}

// Create the component tutors use to manage their available times.
export function AvailabilityManager({ slots = [] }) {
  // Initialize the router for refreshing updated availability.
  const router = useRouter();

  // Track loading progress, error messages, and success messages.
  const [state, setState] = useState({
    loading: false,
    error: "",
    message: "",
  });

  // Handle adding a new available time slot.
  async function submit(event) {
    // Prevent the form from refreshing the page.
    event.preventDefault();

    // Collect the date and time values entered by the tutor.
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const values = Object.fromEntries(form.entries());

    // Make sure the end time is later than the start time.
    if (values.startTime >= values.endTime) {
      setState({
        loading: false,
        error: "End time must be later than start time.",
        message: "",
      });
      return;
    }

    // Show the loading state while saving the new time slot.
    setState({
      loading: true,
      error: "",
      message: "",
    });

    try {
      // Send the new availability information to the API.
      const response = await fetch("/api/availability", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      // Read the response returned by the API.
      const data = await response.json();

      // Display an error if the time slot cannot be saved.
      if (!response.ok) {
        throw new Error(
          data.error || "Unable to add availability."
        );
      }

      // Clear the form after successfully adding the time slot.
      formElement.reset();

      // Display a message confirming the time was added.
      setState({
        loading: false,
        error: "",
        message: "Availability added.",
      });

      // Refresh the page to display the updated availability.
      router.refresh();
    } catch (error) {
      // Show an error message if the request fails.
      setState({
        loading: false,
        error: error.message || "Unable to add availability.",
        message: "",
      });
    }
  }

  // Handle removing an existing available time slot.
  async function remove(id) {
    // Show the loading state while removing the time slot.
    setState({
      loading: true,
      error: "",
      message: "",
    });

    try {
      // Send a request to delete the selected time slot.
      const response = await fetch("/api/availability", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      // Read the response returned by the API.
      const data = await response.json();

      // Display an error if the time slot cannot be removed.
      if (!response.ok) {
        throw new Error(
          data.error || "Unable to remove time."
        );
      }

      // Display a message confirming the time was removed.
      setState({
        loading: false,
        error: "",
        message: "Time removed.",
      });

      // Refresh the page to update the list of available times.
      router.refresh();
    } catch (error) {
      // Show an error message if the removal request fails.
      setState({
        loading: false,
        error: error.message || "Unable to remove time.",
        message: "",
      });
    }
  }

  // Display the tutor's available times and the form for adding new ones.
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_330px]">
      {/* Display the tutor's existing available time slots. */}
      <section className="panel p-6 sm:p-8">
        <h2 className="text-xl font-extrabold">
          Your available times
        </h2>

        <p className="mt-2 text-sm text-[#71809a]">
          Students can request any open time listed here.
        </p>

        {/* Show the available time slots if any have been added. */}
        {slots.length ? (
          <div className="mt-6 divide-y divide-[#edf0f5]">
            {slots.map((slot) => (
              <div
                key={slot.id}
                className="flex items-center gap-4 py-4"
              >
                {/* Display a calendar icon beside each time slot. */}
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#edf1fa] text-[#26469b]">
                  <CalendarIcon />
                </span>

                {/* Display the date and time of the available session. */}
                <div className="flex-1">
                  <p className="font-bold">
                    {new Date(slot.date).toLocaleDateString(
                      "en-CA",
                      {
                        timeZone: "UTC",
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  </p>

                  <p className="mt-1 text-sm text-[#71809a]">
                    {slot.startTime}–{slot.endTime}
                  </p>
                </div>

                {/* Allow the tutor to remove an available time slot. */}
                <button
                  type="button"
                  disabled={state.loading}
                  onClick={() => remove(slot.id)}
                  className="rounded-lg px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          // Show a message when no available times have been added.
          <div className="mt-7 rounded-2xl bg-[#f7f9fc] p-8 text-center text-sm text-[#71809a]">
            No available times yet. Add your first slot.
          </div>
        )}
      </section>

      {/* Display the form for adding a new available time slot. */}
      <aside className="panel h-fit p-6">
        <h2 className="text-lg font-extrabold">
          Add a time slot
        </h2>

        {/* Submit the selected date and time using the submit function. */}
        <form onSubmit={submit} className="mt-5 space-y-4">
          {/* Allow the tutor to select a date. */}
          <label>
            <span className="form-label">Date</span>
            <input
              name="date"
              required
              type="date"
              className="form-input"
            />
          </label>

          {/* Allow the tutor to select the start and end times. */}
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="form-label">Start</span>
              <input
                name="startTime"
                required
                type="time"
                className="form-input px-3"
              />
            </label>

            <label>
              <span className="form-label">End</span>
              <input
                name="endTime"
                required
                type="time"
                className="form-input px-3"
              />
            </label>
          </div>

          {/* Display an error message if the request fails. */}
          {state.error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700"
            >
              {state.error}
            </p>
          )}

          {/* Display a success message after saving or removing a time slot. */}
          {state.message && (
            <p
              role="status"
              className="rounded-xl bg-green-50 p-3 text-xs font-semibold text-green-700"
            >
              {state.message}
            </p>
          )}

          {/* Save the new availability and show progress while loading. */}
          <button
            type="submit"
            disabled={state.loading}
            className="btn-primary w-full"
          >
            {state.loading ? "Saving…" : "Add availability"}
          </button>
        </form>
      </aside>
    </div>
  );
}
