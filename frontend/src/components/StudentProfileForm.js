"use client";

import { useState } from "react";

const FIELDS = [
  {
    name: "displayName",
    label: "Display name",
    placeholder: "Your preferred display name",
    max: 150,
    rows: 0,
  },
  {
    name: "biography",
    label: "Biography",
    placeholder: "Tell us about yourself",
    max: 1500,
    rows: 5,
  },
  {
    name: "learningInterests",
    label: "Learning interests",
    placeholder: "What are you interested in learning?",
    max: 1000,
    rows: 3,
  },
  {
    name: "education",
    label: "Education",
    placeholder: "Your educational background",
    max: 1000,
    rows: 3,
  },
  {
    name: "learningGoals",
    label: "Learning goals",
    placeholder: "What would you like to achieve?",
    max: 1000,
    rows: 3,
  },
];

export default function StudentProfileForm({
  profile,
  fullName,
  onSaved,
  onCancel,
}) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      FIELDS.map(({ name }) => [
        name,
        profile[name] || "",
      ])
    )
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateField(name, value) {
    setValues((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (saving) return;

    setError("");

    const body = Object.fromEntries(
      FIELDS.map(({ name }) => [
        name,
        values[name].trim(),
      ])
    );

    if (
      body.displayName &&
      Array.from(body.displayName).length < 2
    ) {
      setError(
        "Display name must contain at least two characters."
      );
      return;
    }

    for (const field of FIELDS) {
      if (
        Array.from(body[field.name]).length > field.max
      ) {
        setError(
          `${field.label} must not exceed ${field.max} characters.`
        );
        return;
      }
    }

    setSaving(true);

    try {
      const response = await fetch(
        "/api/profile/student",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify(body),
        }
      );

      const result = await response
        .json()
        .catch(() => null);

      if (
        !response.ok ||
        result?.success !== true ||
        !result.profile
      ) {
        throw new Error(
          result?.error ||
          "Unable to save your profile."
        );
      }

      onSaved(result.profile);

    } catch (error) {
      setError(
        error.message ||
        "Unable to save your profile."
      );
    } finally {
      setSaving(false);
    }
  }

  const name =
    values.displayName.trim() ||
    fullName ||
    "Student";

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) =>
      part.charAt(0).toUpperCase()
    )
    .join("");

  const inputClass =
    "mt-2 w-full rounded-xl border border-[#dce3ee] bg-white px-4 py-3 text-sm text-[#17233d] outline-none focus:border-[#26469b] focus:ring-2 focus:ring-[#26469b]/15 disabled:opacity-60";

  return (
    <form
      onSubmit={handleSubmit}
      className="panel min-w-0 space-y-6 p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-center gap-4 border-b border-[#edf0f5] pb-6">
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-[#e8eefb] text-2xl font-extrabold text-[#26469b]">
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-bold">
            Profile picture
          </p>

          <p className="mt-1 text-sm text-[#68758c]">
            Profile picture uploads coming soon.
          </p>
        </div>
      </div>

      <p className="text-sm leading-6 text-[#68758c]">
        All fields are optional. Your learning profile
        is currently private.
      </p>

      {FIELDS.map((field) => (
        <div key={field.name}>
          <label
            htmlFor={`student-profile-${field.name}`}
            className="block text-sm font-bold"
          >
            {field.label}
          </label>

          {field.rows === 0 ? (
            <input
              id={`student-profile-${field.name}`}
              name={field.name}
              type="text"
              value={values[field.name]}
              placeholder={field.placeholder}
              maxLength={field.max}
              disabled={saving}
              onChange={(event) =>
                updateField(
                  field.name,
                  event.target.value
                )
              }
              className={inputClass}
            />
          ) : (
            <textarea
              id={`student-profile-${field.name}`}
              name={field.name}
              rows={field.rows}
              value={values[field.name]}
              placeholder={field.placeholder}
              maxLength={field.max}
              disabled={saving}
              onChange={(event) =>
                updateField(
                  field.name,
                  event.target.value
                )
              }
              className={`${inputClass} resize-y`}
            />
          )}

          <div className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-[#68758c]">
            <span>
              {field.name === "displayName"
                ? "Leave blank to use your account name."
                : "Optional"}
            </span>

            <span>
              {values[field.name].length}/{field.max}
            </span>
          </div>
        </div>
      ))}

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3 border-t border-[#edf0f5] pt-5">
        <button
          type="submit"
          disabled={saving}
          className="btn-primary flex-1 basis-36 py-3 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save profile"}
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          className="flex-1 basis-36 rounded-xl border border-[#dce3ee] bg-white px-4 py-3 text-sm font-bold text-[#173472] disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
