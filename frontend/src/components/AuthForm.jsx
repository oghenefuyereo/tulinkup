
// Enable client-side interactions in this component.
"use client";

// Import Link for navigation between login and registration pages.
import Link from "next/link";

// Import useState to manage form information and user interactions.
import { useState, useEffect } from "react";

// Import the TuLinkUp logo.
import { Logo } from "./Logo";

// Create a reusable form for both login and registration.
export function AuthForm({
  mode,
  initialRole = "student",
  next = "",
}) {
  // Check whether the user is registering or logging in.
  const register = mode === "register";

  // Store the information entered into the form.
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: initialRole,
    terms: false,
    remember: true,
  });

  // Track error messages and form submission progress.
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reason = params.get("oauth_error");

    if (!reason) return;

    const messages = {
      expired: "Your Google session expired. Please try again.",
      invalid_state: "Google authentication expired or was invalid.",
      cancelled: "Google authentication was cancelled.",
      account_inactive: "Your account is not active.",
      account_not_found: "Please create an account with Google first.",
      account_exists: "An account already exists. Use your original sign-in method.",
      authentication_failed: "Google authentication failed. Please try again."
    };

    setError(
      messages[reason] || "Google authentication failed."
    );

    params.delete("oauth_error");

    const query = params.toString();

    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname +
        (query ? "?" + query : "") +
        window.location.hash
    );
  }, []);

  async function startGoogle() {
    if (loading || googleLoading) return;

    setError("");

    if (register && !form.terms) {
      setError("Accept the terms to create your account.");
      return;
    }

    setGoogleLoading(true);

    try {
      const response = await fetch("/api/auth/google/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode,
          role: form.role,
          termsAccepted: form.terms
        })
      });

      const data = await response.json();

      if (!response.ok || !data.authorizationUrl) {
        throw new Error(
          data.message || "Unable to start Google authentication."
        );
      }

      const destination = new URL(data.authorizationUrl);

      if (destination.origin !== "https://accounts.google.com") {
        throw new Error("Invalid Google authorization destination.");
      }

      window.location.assign(destination.toString());

    } catch (error) {
      setError(error.message || "Google authentication failed.");
      setGoogleLoading(false);
    }
  }

  // Update a specific field whenever the user enters information.
  const set = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  // Handle login and registration when the form is submitted.
  async function submit(event) {
    // Prevent the browser from refreshing the page.
    event.preventDefault();

    if (loading || googleLoading) return;

    // Clear any previous error messages.
    setError("");

    // Make sure both passwords match during registration.
    if (register && form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    // Require users to accept the terms before registering.
    if (register && !form.terms) {
      setError("Accept the terms to create your account.");
      return;
    }

    // Show the loading state while processing the request.
    setLoading(true);

    try {
      // Send the user's information to the authentication API.
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      // Read the response returned by the API.
      const data = await response.json();

      // Display an error message if authentication fails.
      if (!response.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }

      // Choose the correct dashboard based on the user's role.
      const destination =
        next ||
        (data.user.role === "tutor"
          ? "/dashboard/tutor"
          : "/dashboard/student");

      // Redirect the user after successful authentication.
      window.location.assign(destination);
    } catch (err) {
      // Handle unexpected connection or authentication errors.
      console.error("TuLinkUp authentication error:", err);
      setError("Unable to connect. Please try again.");
    } finally {
      // Stop the loading state when the request finishes.
      setLoading(false);
    }
  }

  // Display the login or registration form.
  return (
    <div className="flex min-h-[calc(100vh-72px)] bg-[#f7f9fd]">
      {/* Display the branding section on larger screens. */}
      <div className="hidden w-[44%] flex-col justify-between bg-[#173472] p-12 text-white lg:flex">
        <Logo light />

        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#f5c518]">
            Learn. Practice. Build.
          </p>

          {/* Change the heading depending on the form mode. */}
          <h1 className="mt-5 max-w-lg text-5xl font-extrabold leading-[1.07] tracking-[-.05em]">
            {register
              ? "Join a learning community built for progress."
              : "Welcome back to your next breakthrough."}
          </h1>

          <p className="mt-5 max-w-md leading-7 text-blue-100/75">
            Discover expert support, organise your sessions, and keep moving
            toward your goals.
          </p>
        </div>

        {/* Display the company behind TuLinkUp. */}
        <p className="text-sm text-blue-100/60">
          TuLinkUp by Inovenatic Group
        </p>
      </div>

      {/* Display the main authentication form. */}
      <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[470px] rounded-[26px] border border-[#e2e7ef] bg-white p-6 shadow-[0_18px_60px_rgba(28,45,78,.08)] sm:p-9">
          {/* Show the logo on smaller screens. */}
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>

          {/* Display the appropriate login or registration heading. */}
          <h1 className="text-3xl font-extrabold tracking-[-.04em]">
            {register ? "Create your account" : "Welcome back"}
          </h1>

          <p className="mt-2 text-sm text-[#71809a]">
            {register
              ? "Choose your role and start with TuLinkUp."
              : "Log in to manage your learning journey."}
          </p>

          {/* Submit the form using the authentication function. */}
          <form onSubmit={submit} className="mt-7 space-y-5">
            {/* Allow new users to choose between student and tutor accounts. */}
            {register && (
              <div>
                <label className="form-label">I am joining as</label>

                <div className="grid grid-cols-2 gap-3">
                  {["student", "tutor"].map((role) => (
                    <button
                      type="button"
                      key={role}
                      onClick={() => set("role", role)}
                      className={`rounded-xl border p-4 text-left ${
                        form.role === role
                          ? "border-[#26469b] bg-[#edf1fa]"
                          : "border-[#dce2ec]"
                      }`}
                    >
                      <span className="block text-sm font-extrabold capitalize">
                        {role}
                      </span>

                      <span className="mt-1 block text-xs text-[#748096]">
                        {role === "student"
                          ? "I want to learn"
                          : "I want to teach"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Ask new users to enter their full name. */}
            {register && (
              <label className="block">
                <span className="form-label">Full name</span>
                <input
                  required
                  minLength={2}
                  className="form-input"
                  value={form.fullName}
                  onChange={(e) => set("fullName", e.target.value)}
                  placeholder="Your full name"
                />
              </label>
            )}

            {/* Collect the user's email address. */}
            <label className="block">
              <span className="form-label">Email address</span>
              <input
                required
                type="email"
                className="form-input"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="you@example.com"
              />
            </label>

            {/* Collect the user's password. */}
            <label className="block">
              <span className="form-label">Password</span>
              <input
                required
                minLength={8}
                type="password"
                className="form-input"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="At least 8 characters"
              />
            </label>

            {/* Ask new users to confirm their password. */}
            {register && (
              <label className="block">
                <span className="form-label">Confirm password</span>
                <input
                  required
                  type="password"
                  className="form-input"
                  value={form.confirmPassword}
                  onChange={(e) =>
                    set("confirmPassword", e.target.value)
                  }
                  placeholder="Enter your password again"
                />
              </label>
            )}

            {/* Show the terms checkbox for registration or remember me for login. */}
            {register ? (
              <label className="flex items-start gap-3 text-sm text-[#66728a]">
                <input
                  type="checkbox"
                  checked={form.terms}
                  onChange={(e) => set("terms", e.target.checked)}
                  className="mt-1 accent-[#26469b]"
                />
                <span>
                  I agree to the terms and privacy policy.
                </span>
              </label>
            ) : (
              <div className="flex items-center justify-between text-sm">
                {/* Allow users to select the remember me option. */}
                <label className="flex gap-2 text-[#66728a]">
                  <input
                    type="checkbox"
                    checked={form.remember}
                    onChange={(e) => set("remember", e.target.checked)}
                    className="accent-[#26469b]"
                  />
                  Remember me
                </label>

                {/* Display the password recovery placeholder. */}
                <span className="font-semibold text-[#26469b]">
                  Forgot password?
                </span>
              </div>
            )}

            {/* Display an error message if authentication fails. */}
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700"
              >
                {error}
              </p>
            )}

            {/* Submit the form and show progress while processing. */}
            <button
              type="submit"
              disabled={loading || googleLoading}
              className="btn-primary w-full py-4 disabled:opacity-60"
            >
              {loading
                ? "Please wait…"
                : register
                  ? "Create account"
                  : "Log in"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#e2e7ef]" />
            <span className="text-xs font-semibold text-[#71809a]">
              OR
            </span>
            <div className="h-px flex-1 bg-[#e2e7ef]" />
          </div>

          <button
            type="button"
            onClick={startGoogle}
            disabled={loading || googleLoading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#dce2ec] bg-white px-4 py-3.5 text-sm font-semibold text-[#26354f] transition hover:bg-gray-50 disabled:opacity-60"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path fill="#4285F4" d="M43.61 24.46c0-1.36-.12-2.66-.35-3.92H24v7.42h11a9.4 9.4 0 0 1-4.08 6.17v5h6.6c3.86-3.56 6.09-8.8 6.09-14.67z"/>
              <path fill="#34A853" d="M24 44c5.51 0 10.13-1.83 13.51-4.87l-6.6-5A12.27 12.27 0 0 1 12.65 27H5.83v5.16A20 20 0 0 0 24 44z"/>
              <path fill="#FBBC05" d="M12.65 27a12 12 0 0 1 0-6V15.84H5.83a20 20 0 0 0 0 16.32L12.65 27z"/>
              <path fill="#EA4335" d="M24 11.8c3 0 5.68 1.03 7.8 3.06l5.85-5.85A19.25 19.25 0 0 0 24 4 20 20 0 0 0 5.83 15.84L12.65 21A12 12 0 0 1 24 11.8z"/>
            </svg>

            {googleLoading
              ? "Connecting to Google..."
              : "Continue with Google"}
          </button>

          {/* Allow users to switch between login and registration. */}
          <p className="mt-6 text-center text-sm text-[#6e7a90]">
            {register
              ? "Already have an account?"
              : "New to TuLinkUp?"}{" "}
            <Link
              href={register ? "/login" : "/register"}
              className="font-bold text-[#26469b]"
            >
              {register ? "Log in" : "Create an account"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
