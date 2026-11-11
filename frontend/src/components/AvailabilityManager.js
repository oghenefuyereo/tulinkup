
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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

export function AvailabilityManager({ slots = [] }) {
  const router = useRouter();

  const [state, setState] = useState({
    loading: false,
    error: "",
    message: "",
  });

  async function submit(event) {
    event.preventDefault();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const values = Object.fromEntries(form.entries());

    if (values.startTime >= values.endTime) {
      setState({
        loading: false,
        error: "End time must be later than start time.",
        message: "",
      });
      return;
    }

    setState({
      loading: true,
      error: "",
      message: "",
    });

    try {
      const response = await fetch("/api/availability", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to add availability."
        );
      }

      formElement.reset();

      setState({
        loading: false,
        error: "",
        message: "Availability added.",
      });

      router.refresh();
    } catch (error) {
      setState({
        loading: false,
        error: error.message || "Unable to add availability.",
        message: "",
      });
    }
  }

  async function remove(id) {
    setState({
      loading: true,
      error: "",
      message: "",
    });

    try {
      const response = await fetch("/api/availability", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to remove time."
        );
      }

      setState({
        loading: false,
        error: "",
        message: "Time removed.",
      });

      router.refresh();
    } catch (error) {
      setState({
        loading: false,
        error: error.message || "Unable to remove time.",
        message: "",
      });
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_330px]">
      <section className="panel p-6 sm:p-8">
        <h2 className="text-xl font-extrabold">
          Your available times
        </h2>

        <p className="mt-2 text-sm text-[#71809a]">
          Students can request any open time listed here.
        </p>

        {slots.length ? (
          <div className="mt-6 divide-y divide-[#edf0f5]">
            {slots.map((slot) => (
              <div
                key={slot.id}
                className="flex items-center gap-4 py-4"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#edf1fa] text-[#26469b]">
                  <CalendarIcon />
                </span>

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
          <div className="mt-7 rounded-2xl bg-[#f7f9fc] p-8 text-center text-sm text-[#71809a]">
            No available times yet. Add your first slot.
          </div>
        )}
      </section>

      <aside className="panel h-fit p-6">
        <h2 className="text-lg font-extrabold">
          Add a time slot
        </h2>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <label>
            <span className="form-label">Date</span>
            <input
              name="date"
              required
              type="date"
              className="form-input"
            />
          </label>

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

          {state.error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700"
            >
              {state.error}
            </p>
          )}

          {state.message && (
            <p
              role="status"
              className="rounded-xl bg-green-50 p-3 text-xs font-semibold text-green-700"
            >
              {state.message}
            </p>
          )}

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
