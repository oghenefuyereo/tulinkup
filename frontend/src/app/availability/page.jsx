
"use client";

// Import React hooks and Next.js navigation.
import { useEffect, useState } from "react";
import Link from "next/link";

// Get today's date in the browser's local timezone.
function getToday() {
  const date = new Date();

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Define the initial availability form.
const emptyForm = {
  date: "",
  startTime: "09:00",
  endTime: "12:00",
  isAvailable: true,
};

// Convert database dates to YYYY-MM-DD.
function normalizeDate(value) {
  return String(value || "").slice(0, 10);
}

// Format dates for display.
function formatDate(value) {
  const date = normalizeDate(value);

  return new Date(
    `${date}T12:00:00`
  ).toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// Format 24-hour time for display.
function formatTime(value) {
  const [hours, minutes] = value.split(":");

  const hour = Number(hours);

  const period = hour >= 12 ? "PM" : "AM";

  return `${hour % 12 || 12}:${minutes} ${period}`;
}

// Create the tutor availability page.
export default function AvailabilityPage() {
  const [availability, setAvailability] =
    useState([]);

  const [form, setForm] = useState(emptyForm);

  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  // Retrieve the tutor's teaching schedule.
  async function loadAvailability() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/availability/me",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to load availability."
        );
      }

      if (!Array.isArray(data.availability)) {
        throw new Error(
          "Invalid availability data received."
        );
      }

      setAvailability(data.availability);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  // Load availability when the page opens.
  useEffect(() => {
    const controller = new AbortController();

    async function fetchAvailability() {
      try {
        const response = await fetch("/api/availability/me", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json().catch(() => null);

        if (!response.ok || !Array.isArray(data?.availability)) {
          throw new Error(data?.error || "Unable to load availability.");
        }

        if (!controller.signal.aborted) {
          setAvailability(data.availability);
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

    fetchAvailability();
    return () => controller.abort();
  }, []);

  // Update form values.
  function handleChange(event) {
    const { name, value, checked, type } =
      event.target;

    setForm((previous) => ({
      ...previous,
      [name]:
        type === "checkbox" ? checked : value,
    }));
  }

  // Reset the availability form.
  function resetForm() {
    setForm({ ...emptyForm });
    setEditingId(null);
  }

  // Create or update an availability slot.
  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!form.date) {
      setError("Please select an available date.");
      return;
    }

    if (form.date < getToday()) {
      setError("Please select today or a future date.");
      return;
    }

    if (form.startTime >= form.endTime) {
      setError(
        "End time must be later than start time."
      );
      return;
    }

    // Check for overlapping available time slots.
    const overlappingSlot = availability.some(
      (slot) =>
        String(slot.id) !== String(editingId) &&
        slot.isAvailable &&
        form.isAvailable &&
        normalizeDate(slot.date) === form.date &&
        form.startTime < slot.endTime &&
        form.endTime > slot.startTime
    );

    if (overlappingSlot) {
      setError(
        "This time overlaps an existing availability slot."
      );
      return;
    }

    try {
      setSaving(true);

      const isEditing = editingId !== null;

      const endpoint = isEditing
        ? `/api/availability/${editingId}`
        : "/api/availability";

      const response = await fetch(endpoint, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to save availability."
        );
      }

      resetForm();

      await loadAvailability();

      setSuccess(
        isEditing
          ? "Availability updated successfully."
          : "Availability added successfully."
      );
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  // Populate the form when editing a slot.
  function handleEdit(slot) {
    setEditingId(slot.id);

    setForm({
      date: normalizeDate(slot.date),
      startTime: slot.startTime,
      endTime: slot.endTime,
      isAvailable: slot.isAvailable,
    });

    setError("");
    setSuccess("");

    document
      .getElementById("availability-form")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  // Delete an availability slot.
  async function handleDelete(id) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this availability slot?"
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await fetch(
        `/api/availability/${id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to delete availability."
        );
      }

      if (String(editingId) === String(id)) {
        resetForm();
      }

      await loadAvailability();

      setSuccess(
        "Availability deleted successfully."
      );
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  // Count available slots dated today or later.
  const activeSlots = availability.filter(
    (slot) =>
      slot.isAvailable &&
      normalizeDate(slot.date) >= getToday()
  ).length;

  const inputStyle =
    "mt-2 w-full rounded-xl border border-[#dce2ec] bg-white px-4 py-3 text-[#17233d] outline-none focus:border-[#26469b]";

  return (
    <main className="min-h-screen bg-[#f7f9fd] px-5 py-12 text-[#17233d]">
      <div className="mx-auto max-w-5xl">

        {/* Back navigation */}
        <Link
          href="/"
          className="text-sm font-bold text-[#26469b]"
        >
          ← Back to homepage
        </Link>

        {/* Page heading */}
        <div className="mt-8">
          <p className="text-sm font-extrabold uppercase tracking-widest text-[#26469b]">
            TuLinkUp Tutor Dashboard
          </p>

          <h1 className="mt-3 text-3xl font-extrabold md:text-4xl">
            Manage Your Availability
          </h1>

          <p className="mt-3 text-[#68758c]">
            Set your teaching schedule so students can
            find available times and book tutoring
            sessions.
          </p>
        </div>

        {/* Availability statistics */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#e5e9f0] bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-[#68758c]">
              Total Schedule Slots
            </p>

            <p className="mt-2 text-3xl font-extrabold text-[#26469b]">
              {availability.length}
            </p>
          </div>

          <div className="rounded-2xl border border-[#e5e9f0] bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-[#68758c]">
              Available Slots (Today Onward)
            </p>

            <p className="mt-2 text-3xl font-extrabold text-green-600">
              {activeSlots}
            </p>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"
          >
            {error}
          </div>
        )}

        {/* Success message */}
        {success && (
          <div
            role="status"
            className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-700"
          >
            {success}
          </div>
        )}

        {/* Availability management form */}
        <section
          id="availability-form"
          className="mt-8 rounded-2xl border border-[#e5e9f0] bg-white p-6 shadow-sm"
        >
          <h2 className="text-xl font-bold">
            {editingId !== null
              ? "Edit Availability"
              : "Add New Availability"}
          </h2>

          <p className="mt-2 text-sm text-[#68758c]">
            Choose a date and the time period when you
            are available to teach.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-6"
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">

              {/* Date input */}
              <label className="text-sm font-semibold">
                Available Date

                <input
                  type="date"
                  name="date"
                  min={getToday()}
                  value={form.date}
                  onChange={handleChange}
                  required
                  className={inputStyle}
                />
              </label>

              {/* Start time input */}
              <label className="text-sm font-semibold">
                Start Time

                <input
                  type="time"
                  name="startTime"
                  value={form.startTime}
                  onChange={handleChange}
                  required
                  className={inputStyle}
                />
              </label>

              {/* End time input */}
              <label className="text-sm font-semibold">
                End Time

                <input
                  type="time"
                  name="endTime"
                  value={form.endTime}
                  onChange={handleChange}
                  required
                  className={inputStyle}
                />
              </label>
            </div>

            {/* Availability status */}
            <label className="mt-5 flex items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                name="isAvailable"
                checked={form.isAvailable}
                onChange={handleChange}
                className="h-5 w-5 accent-[#26469b]"
              />

              Available for student bookings
            </label>

            {/* Form actions */}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving || loading}
                className="rounded-xl bg-[#26469b] px-6 py-3 font-bold text-white hover:bg-[#173472] disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingId !== null
                  ? "Update Availability"
                  : "+ Add Availability"}
              </button>

              {editingId !== null && (
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="rounded-xl border border-[#dce2ec] px-6 py-3 font-bold"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Teaching schedule */}
        <section className="mt-8 rounded-2xl border border-[#e5e9f0] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">
              Your Teaching Schedule
            </h2>

            <button
              type="button"
              onClick={loadAvailability}
              disabled={loading || saving}
              className="text-sm font-bold text-[#26469b]"
            >
              Refresh Schedule
            </button>
          </div>

          <p className="mt-2 text-sm text-[#68758c]">
            View, edit, or remove your teaching slots.
          </p>

          {/* Loading state */}
          {loading ? (
            <div className="mt-6 rounded-xl bg-[#f7f9fd] p-8 text-center">
              <p className="text-[#68758c]">
                Loading your schedule...
              </p>
            </div>
          ) : availability.length === 0 ? (

            /* Empty state */
            <div className="mt-6 rounded-xl bg-[#f7f9fd] p-8 text-center">
              <h3 className="font-bold">
                No availability scheduled
              </h3>

              <p className="mt-2 text-sm text-[#68758c]">
                Add your first available date and time
                using the form above.
              </p>
            </div>
          ) : (

            /* Display availability records */
            <div className="mt-6 space-y-4">
              {availability.map((slot) => (
                <article
                  key={slot.id}
                  className="flex flex-col gap-4 rounded-xl border border-[#e5e9f0] p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <h3 className="font-bold">
                      {formatDate(slot.date)}
                    </h3>

                    <p className="mt-1 text-sm text-[#68758c]">
                      {formatTime(slot.startTime)}
                      {" – "}
                      {formatTime(slot.endTime)}
                    </p>

                    <span
                      className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold ${
                        slot.isAvailable
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {slot.isAvailable
                        ? "Available"
                        : "Unavailable"}
                    </span>
                  </div>

                  {/* Schedule actions */}
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleEdit(slot)}
                      className="rounded-lg border border-[#dce2ec] px-4 py-2 text-sm font-bold text-[#26469b]"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        handleDelete(slot.id)
                      }
                      className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
