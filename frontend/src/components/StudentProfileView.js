"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import StudentProfileForm from "@/components/StudentProfileForm";
import StudentProfileAvatar from "@/components/StudentProfileAvatar";
import StudentAccountSettings from "@/components/StudentAccountSettings";
import { Icon } from "@/components/Icons";

const PROFILE_TABS = [
  "About",
  "Posts",
  "Portfolio",
  "Learning history",
];

const PORTFOLIO_ITEMS = [
  {
    title: "Projects",
    description: "Show what you have built.",
    icon: "dashboard",
  },
  {
    title: "Skills",
    description: "Highlight your abilities.",
    icon: "book",
  },
  {
    title: "Certificates",
    description: "Display your earned credentials.",
    icon: "courses",
  },
  {
    title: "Achievements",
    description: "Celebrate your accomplishments.",
    icon: "star",
  },
  {
    title: "Showcase",
    description: "Present your best work.",
    icon: "briefcase",
  },
];

const LEARNING_ITEMS = [
  {
    title: "One-on-one tutoring",
    icon: "user",
  },
  {
    title: "Group classes",
    icon: "calendar",
  },
  {
    title: "Courses",
    icon: "courses",
  },
  {
    title: "Bootcamps",
    icon: "book",
  },
];

function SoonLabel() {
  return (
    <span className="shrink-0 rounded-full bg-[#fff7dc] px-3 py-1 text-xs font-bold text-[#9f7500]">
      Soon
    </span>
  );
}

export default function StudentProfileView({
  fullName,
  email,
  children,
  view = "profile",
}) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState("About");
  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [notice, setNotice] = useState("");
  const [imageVersion, setImageVersion] = useState(0);

  function handleImageChanged(hasProfileImage) {
    setProfile((previous) =>
      previous
        ? { ...previous, hasProfileImage }
        : previous
    );

    setImageVersion((previous) => previous + 1);
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadProfile() {
      try {
        const response = await fetch(
          "/api/profile/student",
          {
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
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
            "Unable to load your profile."
          );
        }

        if (!controller.signal.aborted) {
          setProfile(result.profile);
          setLoadError("");
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(
            error.message ||
            "Unable to load your profile."
          );
        }
      }
    }

    loadProfile();

    return () => controller.abort();
  }, [loadAttempt]);

  function handleProfileSaved(savedProfile) {
    setProfile(savedProfile);
    setActiveTab("About");
    setNotice("Your profile has been updated.");
    router.replace("/profile");
  }

  function retryProfile() {
    setLoadError("");
    setLoadAttempt((previous) => previous + 1);
  }

  const panelId = useId();

  const displayName =
    String(
      profile?.displayName || fullName || "Student"
    ).trim() || "Student";

  const firstName = displayName.split(/\s+/)[0];

  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  // Edit the student learning profile separately.
  if (view === "edit" && profile) {
    return (
      <div className="min-w-0 space-y-5 text-[#17233d]">
        <button
          type="button"
          onClick={() => router.replace("/profile")}
          className="text-sm font-bold text-[#52617b] hover:text-[#26469b]"
        >
          ← Back to my profile
        </button>

        <div>
          <p className="eyebrow">
            Student profile
          </p>

          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
            Edit profile
          </h1>

          <p className="mt-2 text-sm leading-6 text-[#68758c]">
            Personalize your learning profile.
          </p>
        </div>

        <StudentProfileForm
          profile={profile}
          fullName={fullName}
          onSaved={handleProfileSaved}
          onImageChanged={handleImageChanged}
          imageVersion={imageVersion}
          onCancel={() => router.replace("/profile")}
        />
      </div>
    );
  }

  // Keep private account management separate.
  if (view === "settings") {
    return (
      <StudentAccountSettings
        email={email}
        onBack={() => router.replace("/profile")}
      >
        {children}
      </StudentAccountSettings>
    );
  }

  return (
    <main className="min-w-0 space-y-5 text-[#17233d]">

      {notice && (
        <p
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800"
        >
          {notice}
        </p>
      )}

      {loadError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <p>{loadError}</p>

          <button
            type="button"
            onClick={retryProfile}
            className="mt-2 font-bold underline"
          >
            Try again
          </button>
        </div>
      )}

      {!profile && !loadError && (
        <p role="status" className="text-sm text-[#68758c]">
          Loading your learning profile...
        </p>
      )}

      {/* Clean student profile header. */}
      <section className="panel p-5 sm:p-6">

        <div className="flex flex-wrap items-center gap-5">

          <StudentProfileAvatar
            initials={initials}
            hasProfileImage={profile?.hasProfileImage === true}
            version={imageVersion}
          />

          <div className="min-w-0 flex-1 basis-48">

            <h1 className="break-words text-2xl font-extrabold tracking-tight sm:text-3xl">
              {displayName}
            </h1>

            <p className="mt-2 font-semibold text-[#5e6a81]">
              Student
            </p>

            <p className="mt-2 text-sm text-[#68758c]">
              Learning interests and personal information
            </p>

          </div>

        </div>

        {/* Social statistics placeholders. */}
        <div className="mt-6 grid grid-cols-3 divide-x divide-[#e5e9f0] border-y border-[#e5e9f0] py-4">

          {["Followers", "Following", "Posts"].map(
            (label) => (

              <div
                key={label}
                className="px-1 text-center"
              >

                <p
                  aria-label="Count not available"
                  className="text-2xl font-extrabold"
                >
                  —
                </p>

                <p className="mt-1 text-sm font-semibold">
                  {label}
                </p>

                <p className="mt-1 text-xs text-[#68758c]">
                  Soon
                </p>

              </div>

            )
          )}

        </div>

        {/* Student profile actions. */}
        <div className="mt-5 flex flex-wrap gap-3">

          <button
            type="button"
            disabled={!profile}
            onClick={() => {
              setNotice("");
              router.push("/profile?view=edit");
            }}
            className="btn-primary flex min-w-0 flex-1 basis-36 items-center justify-center py-3 disabled:opacity-50"
          >
            Edit profile
          </button>

          <button
            type="button"
            onClick={() => {
              setNotice("");
              router.push("/profile?view=settings");
            }}
            className="flex min-w-0 flex-1 basis-36 items-center justify-center gap-2 rounded-xl border border-[#dce3ee] bg-white px-4 py-3 text-sm font-bold text-[#173472] hover:bg-[#f7f9fd]"
          >

            <Icon
              name="user"
              className="h-4 w-4 shrink-0"
            />

            Account settings

          </button>

        </div>

      </section>

      {/* Interactive student profile navigation. */}
      <section className="panel min-w-0 overflow-hidden">

        <nav
          aria-label="Student profile sections"
          className="flex overflow-x-auto border-b border-[#e5e9f0] px-3"
        >

          {PROFILE_TABS.map((tab) => (

            <button
              key={tab}
              type="button"
              aria-pressed={activeTab === tab}
              aria-controls={panelId}
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 whitespace-nowrap border-b-[3px] px-4 py-4 text-sm font-semibold ${
                activeTab === tab
                  ? "border-[#26469b] text-[#26469b]"
                  : "border-transparent text-[#68758c] hover:text-[#26469b]"
              }`}
            >
              {tab}
            </button>

          ))}

        </nav>

        <div id={panelId} className="p-5 sm:p-7">

          {/* About section. */}
          {activeTab === "About" && (

            <div className="space-y-6">

              <div>

                <h2 className="text-xl font-extrabold">
                  About {firstName}
                </h2>

                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-[#68758c]">
                  {profile
                    ? profile.biography || "No biography added yet."
                    : loadError
                      ? "Profile information unavailable."
                      : "Loading..."}
                </p>

              </div>

              <div className="border-t border-[#edf0f5] pt-5">

                <h3 className="text-lg font-extrabold">
                  Learning interests
                </h3>

                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-[#68758c]">
                  {profile
                    ? profile.learningInterests || "No learning interests added yet."
                    : loadError
                      ? "Profile information unavailable."
                      : "Loading..."}
                </p>

              </div>

              <div className="border-t border-[#edf0f5] pt-5">

                <h3 className="text-lg font-extrabold">
                  Education
                </h3>

                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-[#68758c]">
                  {profile
                    ? profile.education || "No education information added yet."
                    : loadError
                      ? "Profile information unavailable."
                      : "Loading..."}
                </p>

              </div>

              <div className="border-t border-[#edf0f5] pt-5">

                <h3 className="text-lg font-extrabold">
                  Learning goals
                </h3>

                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-[#68758c]">
                  {profile
                    ? profile.learningGoals || "No learning goals added yet."
                    : loadError
                      ? "Profile information unavailable."
                      : "Loading..."}
                </p>

              </div>

            </div>

          )}

          {/* Future educational posts. */}
          {activeTab === "Posts" && (

            <div className="py-10 text-center">

              <Icon
                name="book"
                className="mx-auto mb-4 h-10 w-10 text-[#9aa6bd]"
              />

              <h2 className="text-xl font-extrabold">
                My posts
              </h2>

              <p className="mt-3 text-sm text-[#68758c]">
                Share your learning journey with the community.
              </p>

              <div className="mt-4">
                <SoonLabel />
              </div>

            </div>

          )}

          {/* Student-only portfolio. */}
          {activeTab === "Portfolio" && (

            <div>

              <div className="flex items-center justify-between gap-3">

                <h2 className="text-xl font-extrabold">
                  My portfolio
                </h2>

                <SoonLabel />

              </div>

              <p className="mt-2 text-sm text-[#68758c]">
                Showcase your learning, skills and accomplishments.
              </p>

              <div className="mt-6 space-y-3">

                {PORTFOLIO_ITEMS.map((item) => (

                  <div
                    key={item.title}
                    className="flex items-center gap-4 rounded-xl border border-[#e5e9f0] p-4"
                  >

                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#edf1fa]">

                      <Icon
                        name={item.icon}
                        className="h-5 w-5 text-[#26469b]"
                      />

                    </div>

                    <div className="min-w-0 flex-1">

                      <h3 className="font-bold">
                        {item.title}
                      </h3>

                      <p className="mt-1 text-sm text-[#68758c]">
                        {item.description}
                      </p>

                    </div>

                  </div>

                ))}

              </div>

            </div>

          )}

          {/* Future private learning history. */}
          {activeTab === "Learning history" && (

            <div>

              <div className="flex items-center justify-between gap-3">

                <h2 className="text-xl font-extrabold">
                  Learning history
                </h2>

                <SoonLabel />

              </div>

              <p className="mt-2 text-sm text-[#68758c]">
                Track your learning journey and educational progress.
              </p>

              <div className="mt-6 space-y-3">

                {LEARNING_ITEMS.map((item) => (

                  <div
                    key={item.title}
                    className="flex items-center gap-3 rounded-xl border border-[#e5e9f0] p-4"
                  >

                    <Icon
                      name={item.icon}
                      className="h-5 w-5 shrink-0 text-[#26469b]"
                    />

                    <h3 className="font-semibold">
                      {item.title}
                    </h3>

                  </div>

                ))}

              </div>

              <p className="mt-5 text-xs text-[#68758c]">
                Learning history is planned as a private
                feature for your account.
              </p>

            </div>

          )}

        </div>

      </section>

    </main>
  );
}
