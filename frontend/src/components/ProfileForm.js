// Enable client-side interactions in this component.
"use client";

import { ProfileImageUpload } from "./ProfileImageUpload";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Define the platform pricing rules.
const MAX_HOURLY_RATE_CENTS = 2500;
const PLATFORM_COMMISSION_PERCENT = 20;
const TUTOR_REVENUE_PERCENT = 80;

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

// Convert the hourly rate into Canadian cents.
function toRateCents(value) {
  if (
    value == null ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const amount = Number(value);

  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    amount > MAX_HOURLY_RATE_CENTS / 100
  ) {
    return null;
  }

  const cents = Math.round(amount * 100);

  if (
    Math.abs(amount * 100 - cents) > 0.000001
  ) {
    return null;
  }

  return cents;
}

// Format an amount in Canadian dollars.
function formatCurrency(cents) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);
}

// Calculate estimated earnings for a one-hour session.
function calculateRevenue(hourlyRateCents) {
  const platformCommissionCents = Math.round(
    (hourlyRateCents * PLATFORM_COMMISSION_PERCENT) / 100
  );

  const tutorEarningsCents =
    hourlyRateCents - platformCommissionCents;

  return {
    grossAmountCents: hourlyRateCents,
    platformCommissionCents,
    tutorEarningsCents,
  };
}

// Create a form for students and tutors to update their profiles.
export function ProfileForm({
  user,
  profile,
  subjects = [],
  accountOnly = false,
  returnToProfile = false,
}) {
  // Initialize the router for refreshing profile information.
  const router = useRouter();

  // Track form submission progress, success messages, and errors.
  const [state, setState] = useState({
    loading: false,
    message: "",
    error: "",
  });

  const isTutor = user.role === "tutor" && !accountOnly;
  const professionalOnly = isTutor && returnToProfile;

  // Store the tutor's current hourly rate.
  const [hourlyRate, setHourlyRate] = useState(
    String(
      profile?.hourlyRate ??
      profile?.hourly_rate ??
      25
    )
  );

  // Validate the hourly rate and calculate estimated earnings.
  const hourlyRateCents = toRateCents(hourlyRate);

  const isValidHourlyRate =
    hourlyRateCents !== null;

  const revenue = isValidHourlyRate
    ? calculateRevenue(hourlyRateCents)
    : null;

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
        typeof subject === "string"
          ? subject
          : subject.name
      )
    : typeof profile?.subject === "string"
      ? profile.subject
          .split(",")
          .map((subject) => subject.trim())
          .filter(Boolean)
      : [];

  // Store the subjects currently selected by the tutor.
  const [selected, setSelected] = useState(existingSubjects);

  // Update the hourly rate and clear previous feedback.
  function handleRateChange(event) {
    setHourlyRate(event.target.value);

    setState((current) => ({
      ...current,
      message: "",
      error: "",
    }));
  }

  // Handle saving changes to the user's profile.
  async function submit(event) {
    // Prevent the browser from refreshing when the form is submitted.
    event.preventDefault();

    // Prevent duplicate submissions while saving.
    if (state.loading) return;

    // Require tutors to select at least one subject.
    if (isTutor && selected.length === 0) {
      setState({
        loading: false,
        message: "",
        error: "Choose at least one subject.",
      });
      return;
    }

    // Verify the tutor's hourly rate.
    if (isTutor && !isValidHourlyRate) {
      setState({
        loading: false,
        message: "",
        error:
          "Enter a valid hourly rate between $0 and $25 CAD, with no more than two decimal places.",
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
      if (accountOnly) {
        body.set("scope", "account");
      } else {
        if (professionalOnly) {
          body.set("scope", "professional");
        }

        body.set("subjects", JSON.stringify(selected));
      }

      // Send the validated hourly rate in dollars.
      if (isTutor) {
        body.set(
          "hourlyRate",
          (hourlyRateCents / 100).toFixed(2)
        );
      }

      // Send the updated profile information to the API.
      const response = await fetch("/api/profile", {
        method: "POST",
        body,
      });

      // Read the response returned by the API.
      const data = await response.json();

      // Display an error if the profile cannot be saved.
      if (!response.ok || data.success !== true) {
        throw new Error(
          data.error ||
          data.message ||
          "Unable to save profile."
        );
      }

      // Show a success message after saving the profile.
      setState({
        loading: false,
        error: "",
        message: "Your profile has been updated.",
      });

      // Refresh the page to display the updated profile information.
      if (returnToProfile) {
        // Reload the authenticated profile with fresh
        // database information after a successful save.
        router.replace("/profile");
        router.refresh();
        return;
      }

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
      {!professionalOnly && (
        <>
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

        </>
      )}

      {/* Display additional profile fields for tutors only. */}
      {isTutor && (
        <div className={
          professionalOnly
            ? ""
            : "mt-8 border-t border-[#edf0f5] pt-8"
        }>
          <h2 className="text-xl font-extrabold">
            Professional tutor profile
          </h2>

          <ProfileImageUpload
            profile={profile}
            fullName={user.fullName || user.full_name}
            disabled={state.loading}
          />

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
                Private tutoring hourly rate (CAD)
              </span>

              <input
                name="hourlyRate"
                required
                type="number"
                min="0"
                max={MAX_HOURLY_RATE_CENTS / 100}
                step="0.01"
                value={hourlyRate}
                onChange={handleRateChange}
                aria-invalid={!isValidHourlyRate}
                aria-describedby="hourly-rate-help"
                className="form-input"
                placeholder="25.00"
              />

              <span
                id="hourly-rate-help"
                className="mt-1 block text-xs text-[#71809a]"
              >
                Set your rate between $0 and $25 CAD per
                hour for one-on-one tutoring. Enter $0
                to offer free tutoring sessions.
              </span>

              {!isValidHourlyRate && (
                <span className="mt-1 block text-xs font-semibold text-red-600">
                  Enter a valid rate between $0 and $25 CAD.
                </span>
              )}
            </label>


          </div>

          {/* Display estimated earnings from private tutoring. */}
          {revenue && (
            <section className="mt-6 rounded-xl border border-[#dce3ee] bg-[#f7f9fd] p-5">
              <h3 className="text-lg font-extrabold text-[#173472]">
                Estimated Private Tutoring Earnings
              </h3>

              <p className="mt-2 text-sm leading-6 text-[#64748b]">
                Review how your hourly rate is shared between
                you and TuLinkUp for a one-hour private
                tutoring session.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-[#dce3ee] bg-white p-4">
                  <p className="text-xs font-bold uppercase text-[#8190a8]">
                    Student pays
                  </p>

                  <p className="mt-2 text-2xl font-extrabold text-[#173472]">
                    {formatCurrency(
                      revenue.grossAmountCents
                    )}
                  </p>

                  <p className="mt-1 text-xs text-[#64748b]">
                    CAD per hour
                  </p>
                </div>

                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                  <p className="text-xs font-bold uppercase text-green-700">
                    Your earnings
                  </p>

                  <p className="mt-2 text-2xl font-extrabold text-green-700">
                    {formatCurrency(
                      revenue.tutorEarningsCents
                    )}
                  </p>

                  <p className="mt-1 text-xs text-green-700">
                    {TUTOR_REVENUE_PERCENT}% tutor share
                  </p>
                </div>

                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-xs font-bold uppercase text-[#26469b]">
                    TuLinkUp commission
                  </p>

                  <p className="mt-2 text-2xl font-extrabold text-[#26469b]">
                    {formatCurrency(
                      revenue.platformCommissionCents
                    )}
                  </p>

                  <p className="mt-1 text-xs text-[#26469b]">
                    {PLATFORM_COMMISSION_PERCENT}% platform fee
                  </p>
                </div>
              </div>

              {hourlyRateCents === 0 ? (
                <p className="mt-4 rounded-xl bg-green-100 p-3 text-sm font-semibold text-green-700">
                  You are offering free private tutoring.
                  Students will not be charged, and TuLinkUp
                  will not collect a commission.
                </p>
              ) : (
                <p className="mt-4 text-xs leading-5 text-[#64748b]">
                  These are estimated earnings before any
                  applicable payment processing fees or taxes.
                  Amounts are rounded to the nearest cent.
                  Actual earnings depend on the booked
                  session duration.
                </p>
              )}

              <p className="mt-3 text-xs font-semibold text-[#26469b]">
                Online payments and tutor payouts are
                coming soon.
              </p>
            </section>
          )}

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
      <div className="mt-7 flex flex-wrap justify-end gap-3">
        {returnToProfile && (
          <button
            type="button"
            disabled={state.loading}
            onClick={() => {
              router.replace("/profile");
              router.refresh();
            }}
            className="rounded-xl border border-[#dce3ee] px-6 py-3 text-sm font-bold text-[#173472] disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={
            state.loading ||
            (isTutor && !isValidHourlyRate)
          }
          className="btn-primary px-7 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state.loading ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}