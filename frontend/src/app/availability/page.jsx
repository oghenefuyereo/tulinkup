
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const initialForm = {
  date: "",
  startTime: "09:00",
  endTime: "10:00",
  isAvailable: true,
};

export default function AvailabilityPage() {
  const [slots, setSlots] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadAvailability = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch("/api/availability/me", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to load availability."
        );
      }

      setSlots(
        Array.isArray(data.availability)
          ? data.availability
          : []
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (form.startTime >= form.endTime) {
      setError("End time must be later than start time.");
      return;
    }

    try {
      setSaving(true);

      const url = editingId
        ? `/api/availability/${editingId}`
        : "/api/availability";

      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
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

      setMessage(
        editingId
          ? "Availability updated successfully."
          : "Availability added successfully."
      );

      resetForm();
      await loadAvailability();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(slot) {
    setEditingId(slot.id);

    setForm({
      date: String(slot.date).slice(0, 10),
      startTime: slot.startTime,
      endTime: slot.endTime,
      isAvailable: slot.isAvailable,
    });

    setError("");
    setMessage("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this availability slot?")) {
      return;
    }

    try {
      setDeletingId(id);
      setError("");
      setMessage("");

      const response = await fetch(
        `/api/availability/${id}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to delete availability."
        );
      }

      setMessage("Availability deleted successfully.");

      if (editingId === id) {
        resetForm();
      }

      await loadAvailability();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f9fd] px-5 py-12 text-[#17233d]">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="text-sm font-bold text-[#26469b]"
        >
          ← Back to homepage
        </Link>

        <header className="mt-8">
          <p className="text-sm font-extrabold uppercase tracking-widest text-[#26469b]">
            TuLinkUp Tutor Dashboard
          </p>

          <h1 className="mt-3 text-3xl font-extrabold">
            Manage Your Availability
          </h1>

          <p className="mt-3 text-[#68758c]">
            Set your teaching schedule so students can find
            available times and book tutoring sessions.
          </p>
        </header>

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-green-700"
          >
            {message}
          </div>
        )}

        <section className="mt-8 rounded-2xl border border-[#e5e9f0] bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">
            {editingId ? "Edit Availability" : "Add Availability"}
          </h2>

          <form
            onSubmit={handleSubmit}
            className="mt-6 grid gap-5 sm:grid-cols-2"
          >
            <div className="sm:col-span-2">
              <label
                htmlFor="date"
                className="mb-2 block text-sm font-semibold"
              >
                Date
              </label>

              <input
                id="date"
                type="date"
                required
                value={form.date}
                onChange={(e) =>
                  updateField("date", e.target.value)
                }
                className="w-full rounded-xl border border-[#d8deea] p-3"
              />
            </div>

            <div>
              <label
                htmlFor="startTime"
                className="mb-2 block text-sm font-semibold"
              >
                Start Time
              </label>

              <input
                id="startTime"
                type="time"
                required
                value={form.startTime}
                onChange={(e) =>
                  updateField("startTime", e.target.value)
                }
                className="w-full rounded-xl border border-[#d8deea] p-3"
              />
            </div>

            <div>
              <label
                htmlFor="endTime"
                className="mb-2 block text-sm font-semibold"
              >
                End Time
              </label>

              <input
                id="endTime"
                type="time"
                required
                value={form.endTime}
                onChange={(e) =>
                  updateField("endTime", e.target.value)
                }
                className="w-full rounded-xl border border-[#d8deea] p-3"
              />
            </div>

            <label className="flex items-center gap-3 sm:col-span-2">
              <input
                type="checkbox"
                checked={form.isAvailable}
                onChange={(e) =>
                  updateField("isAvailable", e.target.checked)
                }
              />
              <span className="text-sm font-semibold">
                Available for Bookings
              </span>
            </label>

            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#26469b] px-6 py-3 font-bold text-white disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Availability"
                    : "Save Availability"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-[#d8deea] px-6 py-3 font-bold"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="mt-8 rounded-2xl border border-[#e5e9f0] bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">
            Your Teaching Schedule
          </h2>

          {loading ? (
            <p className="mt-5 text-[#68758c]">
              Loading availability...
            </p>
          ) : slots.length === 0 ? (
            <p className="mt-5 text-[#68758c]">
              No availability slots added yet.
            </p>
          ) : (
            <div className="mt-6 space-y-3">
              {slots.map((slot) => (
                <div
                  key={slot.id}
                  className="flex flex-col gap-4 rounded-xl border border-[#e5e9f0] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-bold">
                      {String(slot.date).slice(0, 10)}
                    </p>

                    <p className="mt-1 text-sm text-[#68758c]">
                      {slot.startTime} – {slot.endTime}
                    </p>

                    <p
                      className={`mt-2 text-xs font-bold ${
                        slot.isAvailable
                          ? "text-green-700"
                          : "text-amber-700"
                      }`}
                    >
                      {slot.isAvailable
                        ? "Available"
                        : "Unavailable"}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleEdit(slot)}
                      className="rounded-lg border border-[#26469b] px-4 py-2 text-sm font-bold text-[#26469b]"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      disabled={deletingId === slot.id}
                      onClick={() => handleDelete(slot.id)}
                      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-600 disabled:opacity-60"
                    >
                      {deletingId === slot.id
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
