"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "../Icons";

// Preserve the existing TuLinkUp subject categories.
const subjectIcons = {
  Mathematics: "∑",
  Programming: "</>",
  English: "Aa",
  Chemistry: "⚗",
  Physics: "Φ",
  Biology: "DNA",
  "Graphic Design": "◇",
};

// Reusable right sidebar section.
function SidebarSection({ title, children, href, label }) {
  return (
    <section className="panel p-4">
      <h2 className="mb-4 text-base font-extrabold text-[#17233d]">
        {title}
      </h2>

      {children}

      {href && (
        <Link
          href={href}
          className="mt-4 flex items-center gap-2 text-sm font-bold text-[#26469b] hover:underline"
        >
          {label}
          <Icon name="arrow" className="h-4 w-4" />
        </Link>
      )}
    </section>
  );
}

// Compact tutor recommendation.
function RecommendedTutor({ tutor }) {
  const name =
    tutor.name || tutor.full_name || "Tutor";

  const imageUrl =
    tutor.image?.url ||
    tutor.profile_image_url ||
    null;

  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  const href = tutor.slug
    ? `/tutors/${encodeURIComponent(tutor.slug)}`
    : "/tutors";

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-[#f7f9fd]"
    >
      <div className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-[#edf1fa]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={`${name}, tutor profile`}
            fill
            sizes="48px"
            className="object-cover object-top"
          />
        ) : (
          <span className="text-sm font-extrabold text-[#26469b]">
            {initials}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-[#17233d]">
          {name}
        </p>

        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#68758c]">
          {tutor.title || "Tutor"}
        </p>
      </div>
    </Link>
  );
}

// Compact upcoming group class.
function UpcomingClass({ groupClass }) {
  const date = new Date(groupClass.scheduled_at);

  const validDate = Number.isFinite(date.getTime());

  const formattedDate = validDate
    ? new Intl.DateTimeFormat("en-CA", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "America/Toronto",
      }).format(date)
    : "Schedule unavailable";

  const href = groupClass.id
    ? `/group-classes/${encodeURIComponent(groupClass.id)}`
    : "/group-classes";

  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-xl p-2 transition-colors hover:bg-[#f7f9fd]"
    >
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#edf1fa]">
        <Icon
          name="calendar"
          className="h-5 w-5 text-[#26469b]"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-bold text-[#17233d]">
          {groupClass.title}
        </p>

        <p className="mt-1 text-xs text-[#68758c]">
          {formattedDate}
        </p>

        <p className="mt-1 text-xs font-semibold text-[#26469b]">
          {groupClass.subject}
        </p>
      </div>
    </Link>
  );
}

// Main right sidebar for the learning feed.
export function FeedRightSidebar({
  tutors = [],
  classes = [],
  subjects = [],
  tutorsError = false,
  classesError = false,
}) {
  const pathname = usePathname() || "/";

  const isSection = (route) =>
    pathname === route ||
    pathname.startsWith(route + "/");

  const isCourses = isSection("/courses");

  let sectionOrder = [
    "tutors",
    "subjects",
    "classes",
    "announcements",
    "connections",
  ];

  if (isSection("/tutors")) {
    sectionOrder = [
      "subjects",
      "tutors",
      "classes",
    ];
  } else if (isSection("/group-classes")) {
    sectionOrder = [
      "classes",
      "subjects",
      "tutors",
    ];
  } else if (isCourses) {
    sectionOrder = [
      "announcements",
      "tutors",
      "classes",
    ];
  } else if (isSection("/jobs")) {
    sectionOrder = [
      "jobs",
      "tutors",
      "subjects",
      "classes",
    ];
  } else if (isSection("/profile")) {
    sectionOrder = [
      "tutors",
      "classes",
      "announcements",
    ];
  }

  const sidebarSections = {
    tutors: (
<SidebarSection
        title="Recommended tutors"
        href="/tutors"
        label="View all tutors"
      >
        {tutorsError ? (
          <p className="text-sm text-[#68758c]">
            Unable to load tutors right now.
          </p>
        ) : tutors.length === 0 ? (
          <p className="text-sm text-[#68758c]">
            No tutors are currently available.
          </p>
        ) : (
          <div className="space-y-2">
            {tutors.slice(0, 3).map((tutor) => (
              <RecommendedTutor
                key={tutor.id ?? tutor.slug}
                tutor={tutor}
              />
            ))}
          </div>
        )}
      </SidebarSection>
    ),
    subjects: (
<SidebarSection title="Popular subjects">
        <div id="subjects" className="flex flex-wrap gap-2">
          {subjects.map((subject) => (
            <Link
              key={subject.id ?? subject.name}
              href={`/tutors?subject=${encodeURIComponent(subject.name)}`}
              className="inline-flex items-center gap-2 rounded-full bg-[#edf1fa] px-3 py-2 text-xs font-semibold text-[#26469b] transition-colors hover:bg-[#dbe4f5]"
            >
              <span aria-hidden="true">
                {subjectIcons[subject.name] || "•"}
              </span>

              {subject.name}
            </Link>
          ))}
        </div>
      </SidebarSection>
    ),
    classes: (
<SidebarSection
        title="Upcoming classes"
        href="/group-classes"
        label="View all classes"
      >
        {classesError ? (
          <p className="text-sm text-[#68758c]">
            Unable to load upcoming classes.
          </p>
        ) : classes.length === 0 ? (
          <p className="text-sm text-[#68758c]">
            No upcoming classes at the moment.
          </p>
        ) : (
          <div className="space-y-2">
            {classes.slice(0, 3).map((groupClass) => (
              <UpcomingClass
                key={groupClass.id}
                groupClass={groupClass}
              />
            ))}
          </div>
        )}
      </SidebarSection>
    ),
    announcements: (
<SidebarSection title={isCourses ? "Course announcements" : "Platform announcements"}>
        <Link
          href="/courses"
          className="block rounded-xl border border-[#f5c518]/30 bg-[#f5c518]/10 p-4 transition-colors hover:bg-[#f5c518]/20"
        >
          <div className="flex items-center gap-2">
            <Icon
              name="courses"
              className="h-5 w-5 text-[#26469b]"
            />

            <h3 className="text-sm font-extrabold text-[#173472]">
              Courses are coming soon!
            </h3>
          </div>

          <p className="mt-2 text-xs leading-5 text-[#68758c]">
            Structured courses, video lessons and
            self-paced learning are coming to TuLinkUp.
          </p>

          <span className="mt-3 inline-block text-xs font-bold text-[#26469b]">
            Learn more
          </span>
        </Link>
      </SidebarSection>
    ),
    connections: (
<SidebarSection title="Suggested connections">
        <div className="rounded-xl bg-[#f7f9fd] p-4">
          <Icon
            name="user"
            className="mb-2 h-6 w-6 text-[#26469b]"
          />

          <p className="text-sm leading-6 text-[#68758c]">
            Connect with tutors, students and other
            members of the learning community.
          </p>

          <span className="mt-3 inline-block rounded-full bg-[#f5c518]/15 px-3 py-1 text-xs font-bold text-[#173472]">
            Coming soon
          </span>
        </div>
      </SidebarSection>
    ),
    jobs: (
<SidebarSection title="Career announcements">
        <Link
          href="/jobs"
          className="block rounded-xl border border-[#f5c518]/30 bg-[#f5c518]/10 p-4 transition-colors hover:bg-[#f5c518]/20"
        >
          <div className="flex items-center gap-2">
            <Icon
              name="briefcase"
              className="h-5 w-5 text-[#26469b]"
            />

            <h3 className="text-sm font-extrabold text-[#173472]">
              Jobs are coming soon!
            </h3>
          </div>

          <p className="mt-2 text-xs leading-5 text-[#68758c]">
            Career opportunities, internships and graduate positions are coming to TuLinkUp.
          </p>

          <span className="mt-3 inline-block text-xs font-bold text-[#26469b]">
            Learn more
          </span>
        </Link>
      </SidebarSection>
    ),
  };

  return (
    <aside
      aria-label="Learning recommendations"
      className="hidden min-w-0 space-y-4 xl:sticky xl:top-24 xl:block xl:self-start xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto"
    >
      {sectionOrder.map((key) => (
        <div key={key}>{sidebarSections[key]}</div>
      ))}

      {/* Compact legal and company information. */}
      <div className="px-2 pb-4 text-xs leading-6 text-[#68758c]">
        <nav
          aria-label="Footer links"
          className="flex flex-wrap gap-x-3 gap-y-1"
        >
          <Link href="/about" className="hover:underline">
            About
          </Link>

          <Link href="/terms" className="hover:underline">
            Terms of Service
          </Link>

          <Link href="/privacy" className="hover:underline">
            Privacy Policy
          </Link>
        </nav>

        <p className="mt-3">
          © 2026 Inovenatic Group.
        </p>

        <p>All rights reserved.</p>
      </div>
    </aside>
  );
}
