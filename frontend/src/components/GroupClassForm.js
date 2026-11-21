
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const BASE_PATH = "/dashboard/tutor/group-classes";

// Group class pricing rules.
const MAX_PRICE_CENTS = 1000;
const MIN_GROUP_CAPACITY = 2;
const MAX_GROUP_STUDENTS = 20;
const MAX_GROUP_REVENUE_CENTS = 10000;
const PLATFORM_COMMISSION_PERCENT = 20;

// Convert a date to the user's local time zone.
function toLocalDateTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return localDate.toISOString().slice(0, 16);
}

// Convert the entered price to cents.
function toPriceCents(value) {
  if (String(value).trim() === "") return null;

  const price = Number(value);

  if (
    !Number.isFinite(price) ||
    price < 0 ||
    price > MAX_PRICE_CENTS / 100
  ) {
    return null;
  }

  const cents = Math.round(price * 100);

  if (Math.abs(price * 100 - cents) > 0.000001) {
    return null;
  }

  return cents;
}

// Calculate the maximum capacity for the selected price.
function getMaximumGroupStudents(priceCents) {
  if (priceCents === null || priceCents === 0) {
    return MAX_GROUP_STUDENTS;
  }

  return Math.min(
    MAX_GROUP_STUDENTS,
    Math.floor(MAX_GROUP_REVENUE_CENTS / priceCents)
  );
}

// Format monetary amounts as Canadian dollars.
function formatCurrency(amountCents) {
  return (amountCents / 100).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });
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

  // Calculate the allowed capacity and estimated earnings.
  const priceCents = toPriceCents(form.price);

  const allowedMaximum =
    getMaximumGroupStudents(priceCents);

  const maximumStudents = Number(form.maximumStudents);
  const minimumStudents = Number(form.minimumStudents);

  const validCapacity =
    Number.isInteger(maximumStudents) &&
    maximumStudents >= MIN_GROUP_CAPACITY &&
    maximumStudents <= allowedMaximum;

  const validMinimum =
    Number.isInteger(minimumStudents) &&
    minimumStudents >= 1 &&
    minimumStudents <= maximumStudents;

  const validPricing =
    priceCents !== null &&
    validCapacity &&
    validMinimum;

  const grossRevenueCents = validPricing
    ? priceCents * maximumStudents
    : 0;

  // Commission is calculated per student to match enrollment pricing.
  const commissionPerStudentCents =
    priceCents === null
      ? 0
      : Math.round(
          (priceCents * PLATFORM_COMMISSION_PERCENT) / 100
        );

  const platformCommissionCents = validPricing
    ? commissionPerStudentCents * maximumStudents
    : 0;

  const tutorEarningsCents =
    grossRevenueCents - platformCommissionCents;

  function updateField(event) {
    const { name, value } = event.target;

    setError("");

    setForm((previous) => {
      const updated = {
        ...previous,
        [name]: value,
      };

      // Reduce the classroom capacity when the price increases.
      if (name === "price") {
        const nextPriceCents = toPriceCents(value);

        if (nextPriceCents !== null) {
          const nextMaximum =
            getMaximumGroupStudents(nextPriceCents);

          if (
            Number(updated.maximumStudents) > nextMaximum
          ) {
            updated.maximumStudents = nextMaximum;
          }

          if (
            Number(updated.minimumStudents) >
            Number(updated.maximumStudents)
          ) {
            updated.minimumStudents =
              Number(updated.maximumStudents);
          }
        }
      }

      // Keep the minimum student requirement within the capacity.
      if (name === "maximumStudents") {
        const nextMaximum = Number(value);

        if (
          Number.isInteger(nextMaximum) &&
          nextMaximum >= MIN_GROUP_CAPACITY &&
          nextMaximum <= getMaximumGroupStudents(
            toPriceCents(previous.price)
          ) &&
          Number(updated.minimumStudents) > nextMaximum
        ) {
          updated.minimumStudents = nextMaximum;
        }
      }

      return updated;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    // Validate the participation fee.
    if (priceCents === null) {
      setError(
        "Enter a valid price between $0 and $10 CAD."
      );
      return;
    }

    // Validate the selected classroom capacity.
    if (!validCapacity) {
      setError(
        `Maximum students must be between ${MIN_GROUP_CAPACITY} and ${allowedMaximum} at this price.`
      );
      return;
    }

    if (!validMinimum) {
      setError(
        "Minimum students must be between 1 and the maximum capacity."
      );
      return;
    }

    // Ensure potential revenue does not exceed $100.
    if (
      priceCents * maximumStudents >
      MAX_GROUP_REVENUE_CENTS
    ) {
      setError(
        "Potential group class revenue cannot exceed $100 CAD."
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
        priceCents,
        minimumStudents,
        maximumStudents,
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
            max={MAX_PRICE_CENTS / 100}
            step="0.01"
            required
            className={inputClass}
          />

          <span className="block text-xs text-[#64748b]">
            Enter a price between $0 and $10 per student.
            Enter 0 for a free class.
          </span>

          <span className="block text-xs text-[#64748b]">
            The maximum potential revenue per class is $100 CAD.
          </span>
        </label>

        {priceCents !== null && (
          <div className="rounded-xl border border-[#dce6fa] bg-[#f0f4ff] p-4">
            <p className="text-sm font-bold text-[#26469b]">
              Allowed classroom capacity
            </p>

            <p className="mt-1 text-xl font-extrabold text-[#17233d]">
              Up to {allowedMaximum} students
            </p>

            <p className="mt-2 text-xs text-[#64748b]">
              At {formatCurrency(priceCents)} per student,
              you can accommodate a maximum of {allowedMaximum} students.
              You can choose a smaller classroom capacity.
            </p>
          </div>
        )}

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
              max={
                validCapacity
                  ? maximumStudents
                  : allowedMaximum
              }
              step="1"
              required
              className={inputClass}
            />

            <span className="text-xs text-[#64748b]">
              Minimum number of students expected to enroll.
            </span>
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
              min={MIN_GROUP_CAPACITY}
              max={allowedMaximum}
              step="1"
              required
              className={inputClass}
            />

            <span className="text-xs text-[#64748b]">
              Select between {MIN_GROUP_CAPACITY} and {allowedMaximum} students.
            </span>
          </label>
        </div>

        <div className="rounded-xl border border-[#dce6fa] bg-[#f0f4ff] p-5">
          <p className="text-sm font-bold text-[#26469b]">
            Potential gross revenue at full capacity
          </p>

          {validPricing ? (
            <>
              <p className="mt-2 text-3xl font-extrabold text-[#17233d]">
                {formatCurrency(grossRevenueCents)}
              </p>

              <p className="mt-2 text-xs text-[#64748b]">
                {maximumStudents} students ×{" "}
                {formatCurrency(priceCents)} per student
              </p>

              <div className="my-5 border-t border-[#dce6fa]" />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-[#dce6fa] bg-white p-4">
                  <p className="text-sm font-bold text-[#64748b]">
                    Your estimated earnings (80%)
                  </p>

                  <p className="mt-2 text-2xl font-extrabold text-[#17233d]">
                    {formatCurrency(tutorEarningsCents)}
                  </p>
                </div>

                <div className="rounded-xl border border-[#dce6fa] bg-white p-4">
                  <p className="text-sm font-bold text-[#64748b]">
                    TuLinkUp commission (20%)
                  </p>

                  <p className="mt-2 text-2xl font-extrabold text-[#17233d]">
                    {formatCurrency(platformCommissionCents)}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-xs text-[#64748b]">
                Estimated earnings are calculated at full
                classroom capacity before payment processing
                fees and taxes. Actual earnings depend on
                paid enrollments. Commission is rounded to
                the nearest cent for each enrollment.
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-[#64748b]">
              Enter a valid price and classroom capacity
              to view your estimated earnings.
            </p>
          )}
        </div>

        {priceCents !== null && priceCents > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-bold text-amber-800">
              Payment integration
            </p>

            <p className="mt-1 text-xs text-amber-700">
              You can create a paid group class, but
              students cannot enroll until online payments
              become available.
            </p>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <Link
            href={BASE_PATH}
            className="rounded-xl border border-[#dce3ee] px-6 py-3 text-sm font-bold"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={loading || !validPricing}
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