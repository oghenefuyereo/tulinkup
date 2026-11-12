
// Enable client-side interactions in this component.
"use client";

// Import useState to manage form information and feedback.
import { useState } from "react";

// Import the router to refresh profile information.
import { useRouter } from "next/navigation";

// Define the default subjects tutors can select.
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

// Create a form for students and tutors to update their profiles.
export function ProfileForm({ user, profile, subjects = [] }) {
  // Initialize the router for refreshing profile information.
  const router = useRouter();

  // Track form submission progress, success messages, and errors.
  const [state, setState] = useState({
    loading: false,
    message: "",
    error: "",
  });

  // Use subjects from the database or the default subject list.
  const availableSubjects = subjects.length
    ? subjects.map((subject) => ({
        id: String(subject.name),
        name: String(subject.name),
      }))
    : DEFAULT_SUBJECTS;

  // Get the subjects already saved in the tutor's profile.
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

  // Store the subjects currently selected by the tutor.
  const [selected, setSelected] = useState(existingSubjects);

  // Handle saving changes to the user's profile.
  async function submit(event) {
    // Prevent the browser from refreshing when the form is submitted.
    event.preventDefault();

    // Prevent duplicate submissions while saving.
    if (state.loading) return;

    // Require tutors to select at least one subject.
    if (user.role === "tutor" && selected.length === 0) {
      setState({
        loading: false,
        message: "",
        error: "Choose at least one subject.",
      });
      return;
    }

    // Show the loading state and clear previous messages.
    setState({
      loading: true,
      message: "",
      error: "",
    });

    try {
      // Collect the information entered into the form.
      const body = new FormData(event.currentTarget);

      // Add the selected subjects as a JSON string.
      body.set("subjects", JSON.stringify(selected));

      // Send the updated profile information to the API.
      const response = await fetch("/api/profile", {
        method: "POST",
        body,
      });

      // Read the response returned by the API.
      const data = await response.json();

      // Display an error if the profile cannot be saved.
      if (!response.ok) {
        throw new Error(
          data.error || "Unable to save profile."
        );
      }

      // Show a success message after saving the profile.
      setState({
        loading: false,
        error: "",
        message: "Your profile has been updated.",
      });

      // Refresh the page to display the updated profile information.
      router.refresh();
    } catch (error) {
      // Display an error if something goes wrong while saving.
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

  // Display the profile editing form.
  return (
    <form onSubmit={submit} className="panel p-6 sm:p-8">
      {/* Display basic account information for all users. */}
      <div className="grid gap-5 sm:grid-cols-2">
        {/* Allow users to update their full name. */}
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

        {/* Allow users to update their phone number. */}
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

      {/* Display additional profile fields for tutors only. */}
      {user.role === "tutor" && (
        <div className="mt-8 border-t border-[#edf0f5] pt-8">
          <h2 className="text-xl font-extrabold">
            Professional tutor profile
          </h2>

          {/* Display professional information fields. */}
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {/* Allow tutors to enter their professional title. */}
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

            {/* Allow tutors to enter their teaching location. */}
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

            {/* Allow tutors to set their hourly teaching rate. */}
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

            {/* Display the profile image upload field. */}
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

              {/* Explain that image uploads are not supported yet. */}
              <span className="mt-1 block text-xs text-[#71809a]">
                Image uploads are not available yet.
                Leave this field empty when saving.
              </span>
            </label>
          </div>

          {/* Allow tutors to write a professional biography. */}
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

          {/* Display fields for qualifications and teaching experience. */}
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {/* Allow tutors to describe their qualifications. */}
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

            {/* Allow tutors to describe their teaching experience. */}
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

          {/* Allow tutors to choose the subjects they teach. */}
          <div className="mt-5">
            <span className="form-label">
              Subjects taught
            </span>

            <div className="flex flex-wrap gap-2">
              {/* Create a selectable button for each available subject. */}
              {availableSubjects.map((subject) => (
                <button
                  key={subject.id}
                  type="button"

                  // Indicate whether the subject is selected.
                  aria-pressed={selected.includes(subject.name)}

                  // Add or remove the subject when clicked.
                  onClick={() =>
                    setSelected((current) =>
                      current.includes(subject.name)
                        ? current.filter(
                            (name) => name !== subject.name
                          )
                        : [...current, subject.name]
                    )
                  }

                  // Highlight subjects that are currently selected.
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

      {/* Display an error message if profile validation or saving fails. */}
      {state.error && (
        <p
          role="alert"
          className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700"
        >
          {state.error}
        </p>
      )}

      {/* Display a confirmation message after a successful update. */}
      {state.message && (
        <p
          role="status"
          className="mt-5 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700"
        >
          {state.message}
        </p>
      )}

      {/* Display the button used to save profile changes. */}
      <div className="mt-7 flex justify-end">
        <button
          type="submit"
          disabled={state.loading}
          className="btn-primary px-7"
        >
          {/* Show saving progress while the request is processing. */}
          {state.loading ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
