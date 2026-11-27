"use client";

import { useRouter } from "next/navigation";

const UPCOMING_SETTINGS = [
  {
    title: "Password and security",
    description:
      "Change your password and manage account security.",
  },
  {
    title: "Notifications",
    description:
      "Manage email and platform notification preferences.",
  },
  {
    title: "Preferences",
    description:
      "Customize your language and time zone.",
  },
  {
    title: "Account management",
    description:
      "Manage account deactivation and deletion.",
  },
];

function SoonLabel() {
  return (
    <span className="shrink-0 rounded-full bg-[#fff7dc] px-3 py-1 text-xs font-bold text-[#9f7500]">
      Soon
    </span>
  );
}

export default function StudentAccountSettings({
  email,
  onBack,
  role = "student",
  children,
}) {
  const router = useRouter();

  const accountEmail =
    typeof email === "string" && email.trim()
      ? email.trim()
      : null;

  return (
    <main className="min-w-0 space-y-5 text-[#17233d]">
      <button
        type="button"
        onClick={
          onBack || (() => {
            router.replace("/profile");
            router.refresh();
          })
        }
        className="text-sm font-bold text-[#52617b] hover:text-[#26469b]"
      >
        ← Back to my profile
      </button>

      <header>
        <p className="eyebrow">
          Your account
        </p>

        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
          Account settings
        </h1>

        <p className="mt-2 text-sm leading-6 text-[#68758c]">
          Manage your personal information, security
          and account preferences.
        </p>
      </header>

      {/* Existing functional account information form. */}
      <section
        aria-labelledby="personal-information-heading"
        className="space-y-3"
      >
        <div className="px-1">
          <h2
            id="personal-information-heading"
            className="text-xl font-extrabold"
          >
            Personal information
          </h2>

          <p className="mt-1 text-sm leading-6 text-[#68758c]">
            Update your full name and phone number.
          </p>
        </div>

        {children}

        <p className="px-1 text-xs leading-5 text-[#68758c]">
          {role === "tutor"
            ? "Your account contact information is separate from your professional profile."
            : "Your phone number is private and is not displayed on your learning profile. To change your preferred display name, use Edit profile."}
        </p>
      </section>

      {/* Display the current account email without
          allowing unsupported email changes. */}
      <section className="panel min-w-0 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold">
            Email address
          </h2>

          <span className="rounded-full bg-[#edf1fa] px-3 py-1 text-xs font-semibold text-[#52617b]">
            Read-only
          </span>
        </div>

        <p className="mt-2 text-sm leading-6 text-[#68758c]">
          Your registered account email address.
        </p>

        <div className="mt-4 rounded-xl border border-[#dce3ee] bg-[#f7f9fd] p-4">
          <p className="text-xs font-semibold text-[#68758c]">
            Current email address
          </p>

          <p className="mt-1 break-all text-sm font-semibold">
            {accountEmail || "Email address unavailable."}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[#68758c]">
            Email changes and verification
          </p>

          <SoonLabel />
        </div>
      </section>

      {/* Describe current privacy without introducing
          unsupported visibility controls. */}
      <section className="panel min-w-0 p-5 sm:p-6">
        <h2 className="text-lg font-extrabold">
          Privacy
        </h2>

        <p className="mt-2 text-sm leading-6 text-[#68758c]">
          {role === "tutor"
            ? "Manage how your professional information is shared."
            : "Manage how your learning information is shared."}
        </p>

        <div className="mt-4 rounded-xl border border-[#dce3ee] bg-[#f7f9fd] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold">
              {role === "tutor"
                ? "Professional profile visibility"
                : "Learning profile visibility"}
            </p>

            <span className="rounded-full bg-[#e8eefb] px-3 py-1 text-xs font-semibold text-[#26469b]">
              {role === "tutor"
                ? "Marketplace"
                : "Private"}
            </span>
          </div>

          <p className="mt-2 text-sm leading-6 text-[#68758c]">
            {role === "tutor"
              ? "Your professional details may be displayed in the tutor marketplace. Your tutor profile picture uses public image storage."
              : "Your learning profile information and student profile picture are currently accessible through your own account."}
          </p>
        </div>

        <p className="mt-4 text-xs leading-5 text-[#68758c]">
          Additional profile visibility controls
          are coming soon.
        </p>
      </section>

      {/* Clearly mark functionality that has
          not yet been implemented. */}
      <section className="panel min-w-0 p-5 sm:p-6">
        <h2 className="text-lg font-extrabold">
          Additional settings
        </h2>

        <div className="mt-4 divide-y divide-[#edf0f5]">
          {UPCOMING_SETTINGS.map((item) => (
            <div
              key={item.title}
              className="flex items-start justify-between gap-3 py-4"
            >
              <div className="min-w-0">
                <h3 className="text-sm font-bold">
                  {item.title}
                </h3>

                <p className="mt-1 text-sm leading-6 text-[#68758c]">
                  {item.description}
                </p>
              </div>

              <SoonLabel />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
