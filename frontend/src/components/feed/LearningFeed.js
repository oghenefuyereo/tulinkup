"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "../Icons";
import { TutorCard } from "../TutorCard";
import GroupClassCard from "../GroupClassCard";

// Available learning feed filters.
const filters = [
  "For you",
  "Tutors",
  "Classes",
  "Posts",
  "Videos",
];

// Features planned for the educational community.
const communityFeatures = [
  {
    title: "Educational posts",
    description: "Share knowledge and useful learning tips.",
    icon: "book",
  },
  {
    title: "Learning videos",
    description: "Discover educational videos from the community.",
    icon: "courses",
  },
  {
    title: "Student questions",
    description: "Ask questions and learn from other members.",
    icon: "message",
  },
  {
    title: "Learning resources",
    description: "Discover and share helpful study materials.",
    icon: "bookmark",
  },
];

function SectionHeading({ title, href, linkLabel, icon }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Icon
          name={icon}
          className="h-5 w-5 text-[#26469b]"
        />

        <h2 className="text-lg font-extrabold text-[#17233d]">
          {title}
        </h2>
      </div>

      {href && (
        <Link
          href={href}
          className="text-sm font-bold text-[#26469b] hover:underline"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

function EmptyState({ message, href, label }) {
  return (
    <div className="rounded-xl bg-[#f7f9fd] p-6 text-center">
      <p className="text-sm leading-6 text-[#68758c]">
        {message}
      </p>

      {href && (
        <Link
          href={href}
          className="mt-3 inline-block text-sm font-bold text-[#26469b] hover:underline"
        >
          {label}
        </Link>
      )}
    </div>
  );
}

export function LearningFeed({
  tutors = [],
  classes = [],
  tutorsError = false,
  classesError = false,
}) {
  const [activeFilter, setActiveFilter] = useState("For you");

  const showTutors =
    activeFilter === "For you" ||
    activeFilter === "Tutors";

  const showClasses =
    activeFilter === "For you" ||
    activeFilter === "Classes";

  const showCommunity =
    activeFilter === "For you" ||
    activeFilter === "Posts" ||
    activeFilter === "Videos";

  const visibleFeatures = communityFeatures.filter((feature) => {
    if (activeFilter === "Videos") {
      return feature.title === "Learning videos";
    }

    if (activeFilter === "Posts") {
      return feature.title !== "Learning videos";
    }

    return true;
  });

  return (
    <section
      aria-label="Learning feed"
      className="min-w-0 space-y-5"
    >
      {/* Learning feed introduction and future composer. */}
      <div className="panel p-5">
        <h1 className="text-2xl font-extrabold text-[#17233d]">
          Learning Feed
        </h1>

        <p className="mt-2 text-sm leading-6 text-[#68758c]">
          Learn. Practice. Build. Connect. Grow.
        </p>

        <div className="mt-5 flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#edf1fa]">
            <Icon
              name="user"
              className="h-6 w-6 text-[#26469b]"
            />
          </div>

          <button
            type="button"
            disabled
            className="min-w-0 flex-1 cursor-not-allowed rounded-full border border-[#dce3ee] bg-[#f7f9fd] px-4 py-3 text-left text-sm text-[#68758c]"
          >
            Share something educational...
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e7eaf1] pt-4">
          {[
            ["book", "Post"],
            ["courses", "Video"],
            ["message", "Question"],
            ["bookmark", "Resource"],
          ].map(([icon, label]) => (
            <span
              key={label}
              className="flex items-center gap-2 text-xs font-semibold text-[#68758c]"
            >
              <Icon
                name={icon}
                className="h-5 w-5 text-[#26469b]"
              />
              {label}
            </span>
          ))}
        </div>

        <p className="mt-4 text-xs font-medium text-[#68758c]">
          Community posting is coming soon.
        </p>
      </div>

      {/* Functional content filters. */}
      <div
        role="group"
        aria-label="Filter learning feed"
        className="flex flex-wrap gap-2"
      >
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            aria-pressed={activeFilter === filter}
            onClick={() => setActiveFilter(filter)}
            className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
              activeFilter === filter
                ? "border-[#26469b] bg-[#26469b] text-white"
                : "border-[#dce3ee] bg-white text-[#68758c] hover:border-[#26469b] hover:text-[#26469b]"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Real upcoming group classes. */}
      {showClasses && (
        <section className="panel p-4 sm:p-5">
          <SectionHeading
            title="Upcoming group classes"
            href="/group-classes"
            linkLabel="View all"
            icon="calendar"
          />

          {classesError ? (
            <EmptyState
              message="Unable to load upcoming classes right now."
              href="/group-classes"
              label="Browse classes"
            />
          ) : classes.length === 0 ? (
            <EmptyState
              message="There are no upcoming group classes at the moment. Check back for new learning opportunities."
              href="/group-classes"
              label="Explore group classes"
            />
          ) : (
            <div className="grid gap-4">
              {classes.slice(0, 3).map((groupClass) => (
                <GroupClassCard
                  key={groupClass.id}
                  groupClass={groupClass}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Real approved tutor profiles. */}
      {showTutors && (
        <section className="panel p-4 sm:p-5">
          <SectionHeading
            title="Tutor recommendations"
            href="/tutors"
            linkLabel="View all"
            icon="user"
          />

          {tutorsError ? (
            <EmptyState
              message="Unable to load tutors right now."
              href="/tutors"
              label="Browse tutors"
            />
          ) : tutors.length === 0 ? (
            <EmptyState
              message="No tutor profiles are currently available."
              href="/tutors"
              label="Find a tutor"
            />
          ) : (
            <div className="grid gap-4">
              {tutors.slice(0, 3).map((tutor) => (
                <TutorCard
                  key={tutor.id ?? tutor.slug}
                  tutor={tutor}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Upcoming educational community features. */}
      {showCommunity && (
        <section className="panel p-5">
          <SectionHeading
            title="Learning community"
            icon="courses"
          />

          <div className="space-y-3">
            {visibleFeatures.map((feature) => (
              <div
                key={feature.title}
                className="flex items-start gap-3 rounded-xl border border-[#e7eaf1] p-4"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#edf1fa]">
                  <Icon
                    name={feature.icon}
                    className="h-5 w-5 text-[#26469b]"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-[#17233d]">
                    {feature.title}
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-[#68758c]">
                    {feature.description}
                  </p>

                  <span className="mt-2 inline-block rounded-full bg-[#f5c518]/15 px-3 py-1 text-xs font-bold text-[#173472]">
                    Coming soon
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
