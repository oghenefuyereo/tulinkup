
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_SUBJECTS = [
  { id: "Mathematics", name: "Mathematics" },
  { id: "English", name: "English" },
  { id: "Physics", name: "Physics" },
  { id: "Chemistry", name: "Chemistry" },
  { id: "Biology", name: "Biology" },
  { id: "Computer Science", name: "Computer Science" },
  { id: "Programming", name: "Programming" },
  { id: "Graphic Design", name: "Graphic Design" },
  { id: "French", name: "French" },
  { id: "Business Studies", name: "Business Studies" },
];

export function ProfileForm({ user, profile, subjects = [] }) {
  const router = useRouter();

  const [state, setState] = useState({
    loading: false,
    message: "",
    error: "",
  });

  const availableSubjects = subjects.length
    ? subjects.map((subject) => ({
        id: String(subject.name),
        name: String(subject.name),
      }))
    : DEFAULT_SUBJECTS;

  const existingSubjects = Array.isArray(profile?.subjects)
    ? profile.subjects.map((subject) =>
        typeof subject === "string" ? subject : subject.name
      )
    : typeof profile?.subject === "string"
      ? profile.subject
          .split(",")
          .map((subject) => subject.trim())
          .filter(Boolean)
      : [];

  const [selected, setSelected] = useState(existingSubjects);

  async function submit(event) {
    event.preventDefault();

    if (state.loading) return;

    if (user.role === "tutor" && selected.length === 0) {
      setState({
        loading: false,
        message: "",
        error: "Choose at least one subject.",
      });
      return;
    }

    setState({
      loading: true,
      message: "",
      error: "",
    });

    try {
      const body = new FormData(event.currentTarget);

      body.set("subjects", JSON.stringify(selected));

      const response = await fetch("/api/profile", {
        method: "POST",
        body,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to save profile."
        );
      }

      setState({
        loading: false,
        error: "",
        message: "Your profile has been updated.",
      });

      router.refresh();
    } catch (error) {
      setState({
        loading: false,
        message: "",
        error:
          error instanceof Error
            ? error.message
            : "Unable to save profile.",
      });
    }
  }

  return (
    <form onSubmit={submit} className="panel p-6 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <label>
          <span className="form-label">Full name</span>
          <input
            name="fullName"
            required
            minLength={2}
            maxLength={100}
            defaultValue={user.fullName || user.full_name || ""}
            className="form-input"
          />
        </label>

        <label>
          <span className="form-label">Phone number</span>
          <input
            name="phone"
            type="tel"
            maxLength={30}
            defaultValue={user.phone ?? ""}
            className="form-input"
            placeholder="+1 555 000 0000"
          />
        </label>
      </div>

      {user.role === "tutor" && (
        <div className="mt-8 border-t border-[#edf0f5] pt-8">
          <h2 className="text-xl font-extrabold">
            Professional tutor profile
          </h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label>
              <span className="form-label">
                Professional title
              </span>
              <input
                name="title"
                required
                maxLength={120}
                defaultValue={profile?.title ?? ""}
                className="form-input"
                placeholder="Mathematics & Physics Educator"
              />
            </label>

            <label>
              <span className="form-label">Location</span>
              <input
                name="location"
                required
                maxLength={120}
                defaultValue={profile?.location ?? ""}
                className="form-input"
                placeholder="Ontario, Canada"
              />
            </label>

            <label>
              <span className="form-label">
                Hourly rate (CAD)
              </span>
              <input
                name="hourlyRate"
                required
                type="number"
                min="10"
                max="500"
                step="0.01"
                defaultValue={
                  profile?.hourlyRate ??
                  profile?.hourly_rate ??
                  40
                }
                className="form-input"
              />
            </label>

            <label>
              <span className="form-label">
                Profile image
              </span>
              <input
                name="profileImage"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="form-input file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-bold file:text-[#26469b]"
              />
              <span className="mt-1 block text-xs text-[#71809a]">
                Image uploads are not available yet.
                Leave this field empty when saving.
              </span>
            </label>
          </div>

          <label className="mt-5 block">
            <span className="form-label">Biography</span>
            <textarea
              name="biography"
              required
              minLength={20}
              maxLength={1500}
              defaultValue={
                profile?.biography ??
                profile?.bio ??
                ""
              }
              className="min-h-28 w-full rounded-xl border border-[#dce2ec] bg-[#f9fafc] p-4 text-sm"
            />
          </label>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label>
              <span className="form-label">
                Qualifications
              </span>
              <textarea
                name="qualifications"
                required
                maxLength={1000}
                defaultValue={
                  profile?.qualifications ?? ""
                }
                className="min-h-28 w-full rounded-xl border border-[#dce2ec] bg-[#f9fafc] p-4 text-sm"
              />
            </label>

            <label>
              <span className="form-label">
                Teaching experience
              </span>
              <textarea
                name="experience"
                required
                maxLength={1000}
                defaultValue={
                  profile?.experience ?? ""
                }
                className="min-h-28 w-full rounded-xl border border-[#dce2ec] bg-[#f9fafc] p-4 text-sm"
              />
            </label>
          </div>

          <div className="mt-5">
            <span className="form-label">
              Subjects taught
            </span>

            <div className="flex flex-wrap gap-2">
              {availableSubjects.map((subject) => (
                <button
                  key={subject.id}
                  type="button"
                  aria-pressed={selected.includes(subject.name)}
                  onClick={() =>
                    setSelected((current) =>
                      current.includes(subject.name)
                        ? current.filter(
                            (name) => name !== subject.name
                          )
                        : [...current, subject.name]
                    )
                  }
                  className={`rounded-full border px-4 py-2 text-sm font-bold ${
                    selected.includes(subject.name)
                      ? "border-[#26469b] bg-[#26469b] text-white"
                      : "border-[#dce2ec] text-[#536079]"
                  }`}
                >
                  {subject.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {state.error && (
        <p
          role="alert"
          className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700"
        >
          {state.error}
        </p>
      )}

      {state.message && (
        <p
          role="status"
          className="mt-5 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700"
        >
          {state.message}
        </p>
      )}

      <div className="mt-7 flex justify-end">
        <button
          type="submit"
          disabled={state.loading}
          className="btn-primary px-7"
        >
          {state.loading ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
