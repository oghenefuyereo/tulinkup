"use client";

import { useRef, useState } from "react";
import StudentProfileAvatar from "@/components/StudentProfileAvatar";

const IMAGE_ENDPOINT = "/api/profile/student/image";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

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
  onImageChanged,
  imageVersion,
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
  const [selectedFile, setSelectedFile] = useState(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState("");
  const [imageNotice, setImageNotice] = useState("");

  const operationLock = useRef(false);

  const busy = saving || imageBusy;

  function selectImage(event) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file || operationLock.current) return;

    setSelectedFile(null);
    setImageError("");
    setImageNotice("");

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setImageError(
        "Only JPEG, PNG, and WebP images are supported."
      );
      return;
    }

    if (file.size === 0) {
      setImageError("The selected image is empty.");
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setImageError(
        "Profile pictures must not exceed 4 MiB."
      );
      return;
    }

    setSelectedFile(file);
  }

  async function changeImage(method) {
    if (operationLock.current) return;

    if (method === "POST" && !selectedFile) return;

    if (method === "DELETE") {
      if (!profile.hasProfileImage) return;

      if (!window.confirm(
        "Remove your profile picture?"
      )) {
        return;
      }
    }

    operationLock.current = true;

    setImageBusy(true);
    setImageError("");
    setImageNotice("");

    try {
      let body;

      if (method === "POST") {
        body = new FormData();
        body.append("image", selectedFile);
      }

      const response = await fetch(IMAGE_ENDPOINT, {
        method,
        credentials: "same-origin",
        cache: "no-store",
        ...(body ? { body } : {}),
      });

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          response.status >= 500
            ? "Unable to confirm the picture update. Refresh your profile before retrying."
            : result?.error || "Unable to update your picture."
        );
      }

      if (
        result?.success !== true ||
        result.hasProfileImage !== (method === "POST") ||
        typeof result.cleanupPending !== "boolean"
      ) {
        throw new Error(
          "Unable to confirm the picture update. Refresh your profile before retrying."
        );
      }

      onImageChanged(result.hasProfileImage);
      setSelectedFile(null);

      const message =
        method === "POST"
          ? "Profile picture saved successfully."
          : "Profile picture removed successfully.";

      setImageNotice(
        result.cleanupPending
          ? `${message} Previous image storage cleanup is pending.`
          : message
      );

    } catch (error) {
      setImageError(
        error instanceof TypeError
          ? "Connection interrupted. Refresh your profile to confirm the picture status."
          : error.message || "Unable to update your picture."
      );

    } finally {
      operationLock.current = false;
      setImageBusy(false);
    }
  }

  function updateField(name, value) {
    setValues((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (operationLock.current) return;

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

    operationLock.current = true;
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
      operationLock.current = false;
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
      <section className="space-y-4 border-b border-[#edf0f5] pb-6">
        <div className="flex flex-wrap items-center gap-4">
          <StudentProfileAvatar
            initials={initials}
            hasProfileImage={profile.hasProfileImage}
            version={imageVersion}
            size="small"
          />

          <div className="min-w-0 flex-1 basis-48">
            <h2 className="font-bold">
              Profile picture
            </h2>

            <p className="mt-1 text-sm text-[#68758c]">
              JPEG, PNG or WebP. Maximum 4 MiB.
            </p>

            <p className="mt-1 text-xs text-[#68758c]">
              Your picture is currently private.
            </p>
          </div>
        </div>

        <div>
          <label
            htmlFor="student-profile-image"
            className="mb-2 block text-sm font-semibold"
          >
            {profile.hasProfileImage
              ? "Choose a replacement picture"
              : "Choose a profile picture"}
          </label>

          <input
            id="student-profile-image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={selectImage}
            className="block w-full min-w-0 rounded-xl border border-[#dce3ee] p-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#edf1fa] file:px-3 file:py-2 file:font-semibold file:text-[#26469b] disabled:opacity-60"
          />
        </div>

        {selectedFile && (
          <div className="rounded-xl bg-[#f7f9fd] p-3">
            <p className="break-all text-sm font-semibold">
              {selectedFile.name}
            </p>

            <p className="mt-1 text-xs text-[#68758c]">
              Ready to upload
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy || !selectedFile}
            onClick={() => changeImage("POST")}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
          >
            {imageBusy
              ? "Please wait..."
              : profile.hasProfileImage
                ? "Replace picture"
                : "Upload picture"}
          </button>

          {profile.hasProfileImage && (
            <button
              type="button"
              disabled={busy}
              onClick={() => changeImage("DELETE")}
              className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Remove picture
            </button>
          )}

          {selectedFile && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setSelectedFile(null)}
              className="rounded-xl border border-[#dce3ee] px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Clear selection
            </button>
          )}
        </div>

        {imageError && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {imageError}
          </p>
        )}

        {imageNotice && (
          <p
            role="status"
            className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800"
          >
            {imageNotice}
          </p>
        )}

        <p className="text-xs leading-5 text-[#68758c]">
          Picture changes are saved immediately after
          uploading or removing a picture. Cancel below
          only discards unsaved text changes.
        </p>
      </section>

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
              disabled={busy}
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
              disabled={busy}
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
          disabled={busy}
          className="btn-primary flex-1 basis-36 py-3 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save profile"}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="flex-1 basis-36 rounded-xl border border-[#dce3ee] bg-white px-4 py-3 text-sm font-bold text-[#173472] disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
