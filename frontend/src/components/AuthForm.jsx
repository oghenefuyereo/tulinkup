
"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "./Logo";

export function AuthForm({
  mode,
  initialRole = "student",
  next = "",
}) {
  const register = mode === "register";

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: initialRole,
    terms: false,
    remember: true,
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  async function submit(event) {
    event.preventDefault();
    setError("");

    if (register && form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (register && !form.terms) {
      setError("Accept the terms to create your account.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }

      const destination =
        next ||
        (data.user.role === "tutor"
          ? "/dashboard/tutor"
          : "/dashboard/student");

      window.location.assign(destination);
    } catch (err) {
      console.error("TuLinkUp authentication error:", err);
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-72px)] bg-[#f7f9fd]">
      <div className="hidden w-[44%] flex-col justify-between bg-[#173472] p-12 text-white lg:flex">
        <Logo light />

        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#f5c518]">
            Learn. Practice. Build.
          </p>

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

        <p className="text-sm text-blue-100/60">
          TuLinkUp by Inovenatic Group
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[470px] rounded-[26px] border border-[#e2e7ef] bg-white p-6 shadow-[0_18px_60px_rgba(28,45,78,.08)] sm:p-9">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>

          <h1 className="text-3xl font-extrabold tracking-[-.04em]">
            {register ? "Create your account" : "Welcome back"}
          </h1>

          <p className="mt-2 text-sm text-[#71809a]">
            {register
              ? "Choose your role and start with TuLinkUp."
              : "Log in to manage your learning journey."}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-5">
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
                <label className="flex gap-2 text-[#66728a]">
                  <input
                    type="checkbox"
                    checked={form.remember}
                    onChange={(e) => set("remember", e.target.checked)}
                    className="accent-[#26469b]"
                  />
                  Remember me
                </label>

                <span className="font-semibold text-[#26469b]">
                  Forgot password?
                </span>
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-4 disabled:opacity-60"
            >
              {loading
                ? "Please wait…"
                : register
                  ? "Create account"
                  : "Log in"}
            </button>
          </form>

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
