
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const BASE_PATH = "/dashboard/tutor/group-classes";

function toLocalDateTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return localDate.toISOString().slice(0, 16);
}

export default function GroupClassForm({
  initialClass = null,
}) {
  const router = useRouter();
  const isEditing = Boolean(initialClass);

  const [form, setForm] = useState({
    title: initialClass?.title || "",
    description: initialClass?.description || "",
    subject: initialClass?.subject || "",
    educationLevel: initialClass?.education_level || "",
    scheduledAt: toLocalDateTime(initialClass?.scheduled_at),
    durationMinutes: initialClass?.duration_minutes ?? 60,
    price: (initialClass?.price_cents ?? 500) / 100,
    minimumStudents: initialClass?.minimum_students ?? 1,
    maximumStudents: initialClass?.maximum_students ?? 20,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const inputClass =
    "w-full rounded-xl border border-[#dce3ee] bg-white px-4 py-3 text-sm outline-none focus:border-[#26469b] focus:ring-2 focus:ring-[#26469b]/10";

  function updateField(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  const grossRevenue =
    Number(form.price) * Number(form.maximumStudents);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (
      Number(form.minimumStudents) >
      Number(form.maximumStudents)
    ) {
      setError(
        "Minimum students cannot exceed maximum students."
      );
      return;
    }

    const scheduledDate = new Date(form.scheduledAt);

    if (
      Number.isNaN(scheduledDate.getTime()) ||
      scheduledDate <= new Date()
    ) {
      setError("Please select a future date and time.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        subject: form.subject.trim(),
        educationLevel: form.educationLevel,
        scheduledAt: scheduledDate.toISOString(),
        durationMinutes: Number(form.durationMinutes),
        priceCents: Math.round(Number(form.price) * 100),
        minimumStudents: Number(form.minimumStudents),
        maximumStudents: Number(form.maximumStudents),
      };

      const endpoint = isEditing
        ? `/api/group-classes/${initialClass.id}`
        : "/api/group-classes";

      const response = await fetch(endpoint, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to save group class."
        );
      }

      router.push(BASE_PATH);
      router.refresh();
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={BASE_PATH}
          className="text-sm font-bold text-[#26469b]"
        >
          ← Back to group classes
        </Link>

        <h1 className="mt-4 text-3xl font-extrabold text-[#17233d]">
          {isEditing
            ? "Edit Group Class"
            : "Create a Group Live Class"}
        </h1>

        <p className="mt-2 text-sm text-[#64748b]">
          Create affordable learning opportunities for
          multiple students in one live session.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="panel space-y-6 p-6"
      >
        <h2 className="text-xl font-extrabold">
          Class information
        </h2>

        <label className="block space-y-2">
          <span className="text-sm font-bold">
            Class title
          </span>

          <input
            name="title"
            value={form.title}
            onChange={updateField}
            placeholder="Introduction to Algebra"
            maxLength={150}
            required
            className={inputClass}
          />
        </label>

        <div className="grid gap-5 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-bold">
              Subject
            </span>

            <input
              name="subject"
              value={form.subject}
              onChange={updateField}
              placeholder="Mathematics"
              maxLength={100}
              required
              className={inputClass}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-bold">
              Education level
            </span>

            <select
              name="educationLevel"
              value={form.educationLevel}
              onChange={updateField}
              required
              className={inputClass}
            >
              <option value="">Select education level</option>
              <option value="Elementary School">
                Elementary School
              </option>
              <option value="Middle School">
                Middle School
              </option>
              <option value="High School">
                High School
              </option>
              <option value="College">College</option>
              <option value="University">University</option>
              <option value="Adult Learning">
                Adult Learning
              </option>
              <option value="All Levels">All Levels</option>
            </select>
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-bold">
            Class description
          </span>

          <textarea
            name="description"
            value={form.description}
            onChange={updateField}
            placeholder="Describe what students will learn..."
            rows={5}
            maxLength={5000}
            required
            className={inputClass}
          />
        </label>

        <hr className="border-[#edf0f5]" />

        <h2 className="text-xl font-extrabold">
          Schedule
        </h2>

        <div className="grid gap-5 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-bold">
              Date and time
            </span>

            <input
              type="datetime-local"
              name="scheduledAt"
              value={form.scheduledAt}
              onChange={updateField}
              required
              className={inputClass}
            />

            <span className="text-xs text-[#64748b]">
              Uses your device&apos;s local time zone.
            </span>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-bold">
              Duration
            </span>

            <select
              name="durationMinutes"
              value={form.durationMinutes}
              onChange={updateField}
              className={inputClass}
            >
              {[15, 30, 45, 60, 90, 120, 150, 180].map(
                (minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} minutes
                  </option>
                )
              )}
            </select>
          </label>
        </div>

        <hr className="border-[#edf0f5]" />

        <h2 className="text-xl font-extrabold">
          Pricing and capacity
        </h2>

        <label className="block space-y-2">
          <span className="text-sm font-bold">
            Price per student (CAD)
          </span>

          <input
            type="number"
            name="price"
            value={form.price}
            onChange={updateField}
            min="0"
            max="1000"
            step="0.01"
            required
            className={inputClass}
          />

          <span className="text-xs text-[#64748b]">
            Enter 0 for a free class. Paid enrollment
            is not available yet.
          </span>
        </label>

        <div className="grid gap-5 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-bold">
              Minimum students
            </span>

            <input
              type="number"
              name="minimumStudents"
              value={form.minimumStudents}
              onChange={updateField}
              min="1"
              max="100"
              step="1"
              required
              className={inputClass}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-bold">
              Maximum students
            </span>

            <input
              type="number"
              name="maximumStudents"
              value={form.maximumStudents}
              onChange={updateField}
              min="2"
              max="100"
              step="1"
              required
              className={inputClass}
            />
          </label>
        </div>

        <div className="rounded-xl border border-[#dce6fa] bg-[#f0f4ff] p-5">
          <p className="text-sm font-bold text-[#26469b]">
            Potential gross revenue at full capacity
          </p>

          <p className="mt-2 text-3xl font-extrabold text-[#17233d]">
            {grossRevenue.toLocaleString("en-CA", {
              style: "currency",
              currency: "CAD",
            })}
          </p>

          <p className="mt-2 text-xs text-[#64748b]">
            Before platform fees, payment fees and taxes.
            This is an estimate, not guaranteed earnings.
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <Link
            href={BASE_PATH}
            className="rounded-xl border border-[#dce3ee] px-6 py-3 text-sm font-bold"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-[#26469b] px-6 py-3 text-sm font-bold text-white hover:bg-[#173472] disabled:opacity-50"
          >
            {loading
              ? "Saving..."
              : isEditing
                ? "Save Changes"
                : "Save as Draft"}
          </button>
        </div>
      </form>
    </div>
  );
}
