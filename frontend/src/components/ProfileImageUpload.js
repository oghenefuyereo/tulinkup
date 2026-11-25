"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export function ProfileImageUpload({
  profile,
  fullName,
  disabled = false,
}) {
  const router = useRouter();
  const inputRef = useRef(null);
  const busyRef = useRef(false);

  const [imageUrl, setImageUrl] = useState(
    profile?.profile_image_url ??
    profile?.profileImageUrl ??
    profile?.image?.url ??
    null
  );

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Release temporary preview URLs when no longer needed.
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }

    const url = URL.createObjectURL(file);

    setPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  const initials = (fullName || "Tutor")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((name) => name.charAt(0).toUpperCase())
    .join("");

  function clearSelection() {
    setFile(null);
    setPreview(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function selectImage(event) {
    const selected = event.target.files?.[0];

    setMessage("");
    setError("");
    setFile(null);
    setPreview(null);

    if (!selected) return;

    if (!ALLOWED_TYPES.includes(selected.type)) {
      setError("Choose a JPEG, PNG, or WebP image.");
      event.target.value = "";
      return;
    }

    if (selected.size > MAX_IMAGE_BYTES) {
      setError("Your image must not exceed 4 MiB.");
      event.target.value = "";
      return;
    }

    if (selected.size === 0) {
      setError("The selected image is empty.");
      event.target.value = "";
      return;
    }

    setFile(selected);
  }

  async function updateImage(method) {
    if (busyRef.current || disabled) return;

    if (method === "POST" && !file) return;

    busyRef.current = true;
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const options = { method };

      if (method === "POST") {
        const body = new FormData();

        body.append("image", file);

        options.body = body;
      }

      const response = await fetch(
        "/api/profile/image",
        options
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Unable to update profile image."
        );
      }

      if (method === "POST" && !data.image?.url) {
        throw new Error(
          "Unable to confirm the uploaded image."
        );
      }

      setImageUrl(data.image?.url ?? null);

      clearSelection();

      setMessage(
        method === "DELETE"
          ? "Profile image removed successfully."
          : "Profile image uploaded successfully."
      );

      router.refresh();
    } catch (error) {
      setError(
        error.message || "Unable to update profile image."
      );
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }

  const displayedImage = preview || imageUrl;
  const isDisabled = disabled || loading;

  return (
    <section className="mt-6 rounded-xl border border-[#dce3ee] bg-[#f7f9fd] p-5">
      <h3 className="text-lg font-extrabold text-[#173472]">
        Profile picture
      </h3>

      <p className="mt-1 text-sm text-[#64748b]">
        Help students recognize you by adding a professional
        profile picture.
      </p>

      <div className="mt-5 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <div className="relative flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#dce3ee] bg-[#e8eefb]">
          {displayedImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={displayedImage}
              alt={preview ? "Selected image preview" : "Tutor profile picture"}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-3xl font-extrabold text-[#26469b]">
              {initials}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <label
            htmlFor="tutor-profile-image"
            className="form-label"
          >
            {imageUrl ? "Choose a replacement image" : "Choose an image"}
          </label>

          <input
            id="tutor-profile-image"
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={selectImage}
            disabled={isDisabled || !profile}
            className="form-input file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-bold file:text-[#26469b]"
          />

          <p className="mt-2 text-xs text-[#71809a]">
            JPEG, PNG or WebP. Maximum 4 MiB.
            Images are automatically optimized.
          </p>

          {file && (
            <p className="mt-2 break-all text-xs font-semibold text-[#26469b]">
              Preview: {file.name}
            </p>
          )}

          {!profile && (
            <p className="mt-2 text-sm text-amber-700">
              Save your professional profile before uploading
              a picture.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isDisabled || !file || !profile}
              onClick={() => updateImage("POST")}
              className="btn-primary px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Processing..."
                : imageUrl
                  ? "Replace picture"
                  : "Upload picture"}
            </button>

            {file && (
              <button
                type="button"
                disabled={isDisabled}
                onClick={clearSelection}
                className="rounded-xl border border-[#dce3ee] bg-white px-4 py-2 text-sm font-bold text-[#536079]"
              >
                Cancel
              </button>
            )}

            {imageUrl && (
              <button
                type="button"
                disabled={isDisabled}
                onClick={() => updateImage("DELETE")}
                className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-600 disabled:opacity-50"
              >
                Remove picture
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700"
        >
          {error}
        </p>
      )}

      {message && (
        <p
          role="status"
          className="mt-4 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700"
        >
          {message}
        </p>
      )}

      <p className="mt-4 text-xs text-[#71809a]">
        Your profile picture will be visible to students on
        TuLinkUp.
      </p>
    </section>
  );
}
