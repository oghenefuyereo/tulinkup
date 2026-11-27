import TutorProfileSections from "@/components/TutorProfileSections";
import MessageTutorButton from "@/components/messaging/MessageTutorButton";


// Import Image to display tutor profile pictures.
import Image from "next/image";

// Import Link to navigate between pages in Next.js.
import Link from "next/link";

// Import notFound to display a 404 page when a tutor does not exist.
import { notFound } from "next/navigation";

// Import the components used on the tutor profile page.

import { Icon } from "@/components/Icons";

// Make sure the page loads fresh information for each request.
export const dynamic = "force-dynamic";

// Set the Express backend URL for tutor profile requests.
const API_URL = process.env.API_URL || "http://localhost:5001";

// Create a helper function to retrieve a tutor using their unique slug.
async function getTutorBySlug(slug) {
  // Request the tutor's profile from the Express backend.
  const response = await fetch(
    `${API_URL}/api/tutors/${encodeURIComponent(slug)}`,
    { cache: "no-store" }
  );

  // Return null if the tutor cannot be found.
  if (response.status === 404) return null;

  // Stop loading if the backend cannot retrieve the tutor's profile.
  if (!response.ok) {
    throw new Error("Unable to load tutor profile.");
  }

  // Read and return the tutor's profile information.
  const data = await response.json();
  return data.tutor || null;
}

// Create a helper function to retrieve additional tutor information.
async function getTutorExtras(slug) {
  // Request the tutor's reviews and availability from the backend.
  const response = await fetch(
    `${API_URL}/api/tutors/${encodeURIComponent(slug)}/extras`,
    { cache: "no-store" }
  );

  // Return empty lists if no additional tutor details are found.
  if (response.status === 404) {
    return { reviews: [], availability: [] };
  }

  // Stop loading if the additional tutor details cannot be retrieved.
  if (!response.ok) {
    throw new Error("Unable to load tutor details.");
  }

  // Read the additional information returned by the backend.
  const data = await response.json();

  // Return the tutor's reviews and available time slots.
  return {
    reviews: Array.isArray(data.reviews) ? data.reviews : [],
    availability: Array.isArray(data.availability)
      ? data.availability
      : [],
  };
}

// Create the public profile page for an individual tutor.
export default async function TutorProfilePage({ params }) {
  // Get the tutor's unique slug from the page URL.
  const { slug } = await params;

  // Retrieve the selected tutor's profile.
  const tutor = await getTutorBySlug(slug);

  // Display a 404 page if the tutor does not exist.
  if (!tutor) notFound();

  // Retrieve the tutor's reviews and availability.
  const extras = await getTutorExtras(slug);

  // Get the tutor's name or use a default name if unavailable.
  const name = tutor.name || tutor.full_name || "Tutor";

  // Prepare the tutor's subjects for display on the profile.
  const subjects = Array.isArray(tutor.subjects)
    ? tutor.subjects
    : typeof tutor.subject === "string"
      ? tutor.subject.split(",").map((subject) => ({
          id: subject.trim(),
          name: subject.trim(),
        }))
      : [];


  // Validate the tutor's hourly rate.
  const rawRate = tutor.hourlyRate ?? tutor.hourly_rate;

  const hourlyRate =
    ["number", "string"].includes(typeof rawRate) &&
    String(rawRate).trim() !== ""
      ? Number(rawRate)
      : NaN;

  const validRate =
    Number.isFinite(hourlyRate) &&
    hourlyRate >= 0 &&
    hourlyRate <= 25 &&
    Math.abs(
      hourlyRate * 100 - Math.round(hourlyRate * 100)
    ) < 0.000001;

  const isFree = validRate && hourlyRate === 0;

  const available =
    tutor.availabilityStatus === "available";

  // Format the stored calendar date.
  function formatDate(value) {
    const match = String(value ?? "").match(
      /^(\d{4}-\d{2}-\d{2})(?:T|$)/
    );

    if (!match) return "Date unavailable";

    const date = new Date(`${match[1]}T00:00:00Z`);

    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== match[1]
    ) {
      return "Date unavailable";
    }

    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }).format(date);
  }

  // Format the stored time without changing its value.
  function formatTime(value) {
    const match = String(value ?? "").match(
      /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?$/
    );

    if (!match) return "Time unavailable";

    const hours = Number(match[1]);

    return `${hours % 12 || 12}:${match[2]} ${hours >= 12 ? "PM" : "AM"}`;
  }

  // Separate qualifications into individual entries.
  const qualifications = String(
    tutor.qualifications || ""
  )
    .split("•")
    .map((item) => item.trim())
    .filter(Boolean);

  // Prepare teaching subjects.
  const subjectLabels = (
    <div className="flex flex-wrap gap-2">
      {subjects.map((subject, index) => {
        const label =
          typeof subject === "string"
            ? subject
            : subject?.name;

        if (!label) return null;

        return (
          <span
            key={`${label}-${index}`}
            className="subject-pill"
          >
            {label}
          </span>
        );
      })}
    </div>
  );

  // Reusable availability display.
  function renderAvailability(slots) {
    if (!slots.length) {
      return (
        <p className="text-sm text-[#68758c]">
          No available times posted yet.
        </p>
      );
    }

    return (
      <div className="space-y-4">
        {slots.map((slot) => (
          <div
            key={slot.id}
            className="flex items-center gap-3"
          >
            <Icon
              name="calendar"
              className="h-5 w-5 shrink-0 text-[#26469b]"
            />

            <div className="min-w-0">
              <p className="text-sm font-bold">
                {formatDate(slot.date)}
              </p>

              <p className="mt-1 text-sm text-[#68758c]">
                {formatTime(slot.startTime)}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Prepare interactive profile sections.
  const sections = [
    {
      label: "About",
      content: (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-extrabold">
              About {name.split(" ")[0]}
            </h2>

            <p className="mt-3 whitespace-pre-line leading-7 text-[#59667e]">
              {tutor.biography ||
                tutor.bio ||
                "No biography yet."}
            </p>
          </div>

          <div className="border-t border-[#edf0f5] pt-5">
            <h2 className="text-lg font-extrabold">
              Teaching experience
            </h2>

            <p className="mt-3 whitespace-pre-line leading-7 text-[#59667e]">
              {tutor.experience || "Not provided yet."}
            </p>
          </div>

          <div className="border-t border-[#edf0f5] pt-5">
            <h2 className="mb-3 text-lg font-extrabold">
              Teaching subjects
            </h2>

            {subjects.length
              ? subjectLabels
              : "No subjects provided yet."}
          </div>
        </div>
      ),
    },

    {
      label: "Subjects",
      content: (
        <div>
          <h2 className="mb-4 text-xl font-extrabold">
            Teaching subjects
          </h2>

          {subjects.length
            ? subjectLabels
            : "No subjects provided yet."}
        </div>
      ),
    },

    {
      label: "Qualifications",
      content: (
        <div>
          <h2 className="mb-4 text-xl font-extrabold">
            Qualifications
          </h2>

          {qualifications.length ? (
            <ul className="space-y-4">
              {qualifications.map((item, index) => (
                <li
                  key={index}
                  className="flex items-start gap-3"
                >
                  <Icon
                    name="courses"
                    className="mt-1 h-5 w-5 shrink-0 text-[#26469b]"
                  />

                  <span className="whitespace-pre-line text-sm leading-6 text-[#59667e]">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>Not provided yet.</p>
          )}
        </div>
      ),
    },

    {
      label: "Availability",
      content: (
        <div>
          <h2 className="mb-4 text-xl font-extrabold">
            Availability
          </h2>

          {renderAvailability(extras.availability)}
        </div>
      ),
    },

    {
      label: "Reviews",
      content: (
        <div>
          <h2 className="text-xl font-extrabold">
            Student reviews
          </h2>

          {extras.reviews.length ? (
            <div className="mt-5 space-y-5">
              {extras.reviews.map((review) => (
                <article
                  key={review.id}
                  className="border-t border-[#edf0f5] pt-5 first:border-0"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="font-bold">
                      {review.student}
                    </p>

                    <p className="text-sm font-bold text-[#b58a00]">
                      {"★".repeat(
                        Math.max(
                          0,
                          Math.min(
                            5,
                            Math.floor(
                              Number(review.rating) || 0
                            )
                          )
                        )
                      )}
                    </p>
                  </div>

                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#66728a]">
                    {review.comment}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center">
              <Icon
                name="star"
                className="mx-auto mb-3 h-10 w-10 text-[#9aa6bd]"
              />

              <p className="font-bold">
                No reviews yet.
              </p>

              <p className="mt-2 text-sm text-[#68758c]">
                Student reviews will appear here.
              </p>
            </div>
          )}
        </div>
      ),
    },

    {
      label: "Posts",
      soon: true,
      content: (
        <div className="py-10 text-center">
          <Icon
            name="book"
            className="mx-auto mb-3 h-10 w-10 text-[#9aa6bd]"
          />

          <h2 className="text-lg font-extrabold">
            Educational posts
          </h2>

          <p className="mt-2 text-sm text-[#68758c]">
            Tutors will be able to share educational
            content and learning resources.
          </p>

          <span className="mt-4 inline-block rounded-full bg-[#fff7dc] px-3 py-1 text-xs font-bold text-[#9f7500]">
            Coming soon
          </span>
        </div>
      ),
    },


  ];

  return (
    <main className="min-w-0 space-y-5 bg-[#f7f9fd] py-2 text-[#17233d]">
      <Link
        href="/tutors"
        className="inline-flex items-center gap-2 text-sm font-bold text-[#52617b]"
      >
        ← Back to tutors
      </Link>

      {/* Clean profile header without a top banner. */}
      <section className="panel p-5 sm:p-6">

        {/* Tutor profile picture and personal information. */}
        <div className="flex flex-wrap items-start gap-5">

          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-[#edf1f7] sm:h-28 sm:w-28">

            {tutor.image?.url ? (
              <Image
                src={tutor.image.url}
                alt={tutor.image.alt || name}
                fill
                sizes="112px"
                className="object-cover object-top"
              />
            ) : (
              <div className="grid h-full place-items-center text-3xl font-extrabold text-[#26469b]">
                {name
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) =>
                    part.charAt(0).toUpperCase()
                  )
                  .join("")}
              </div>
            )}

          </div>

          <div className="min-w-0 flex-1 basis-48">

            <div className="flex flex-wrap items-center gap-2">

              <h1 className="break-words text-2xl font-extrabold tracking-tight sm:text-3xl">
                {name}
              </h1>

              {tutor.verified === true && (
                <span
                  aria-label="Verified tutor"
                  title="Verified tutor"
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#26469b] text-xs font-bold text-white"
                >
                  ✓
                </span>
              )}

            </div>

            <p className="mt-2 font-semibold text-[#5e6a81]">
              {tutor.title || "Professional Tutor"}
            </p>

            {tutor.location && (
              <p className="mt-2 flex items-center gap-2 text-sm text-[#68758c]">

                <Icon
                  name="location"
                  className="h-4 w-4 shrink-0 text-[#26469b]"
                />

                {tutor.location}

              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3">

              <span className={`flex items-center gap-2 text-xs font-semibold ${
                available
                  ? "text-[#118447]"
                  : "text-[#9b7300]"
              }`}>

                <span aria-hidden="true">●</span>

                {available
                  ? "Available now"
                  : "By appointment"}

              </span>

              {tutor.rating != null && (
                <span className="flex items-center gap-1 text-sm font-bold">

                  <Icon
                    name="star"
                    className="h-4 w-4 fill-[#f5c518] stroke-[#f5c518]"
                  />

                  {tutor.rating} ({tutor.reviewCount ?? 0})

                </span>
              )}

            </div>
          </div>
        </div>

        {/* Followers, Following and Sessions. */}
        <div className="mt-6 grid grid-cols-3 divide-x divide-[#e5e9f0] border-y border-[#e5e9f0] py-4">

          {[
            ["Followers", "Soon"],
            ["Following", "Soon"],
            ["Sessions", "Completed sessions"],
          ].map(([label, status]) => (

            <div key={label} className="px-1 text-center">

              <p className="text-2xl font-extrabold">
                —
              </p>

              <p className="mt-1 text-sm font-semibold">
                {label}
              </p>

              <p className="mt-1 text-xs text-[#68758c]">
                {status}
              </p>

            </div>
          ))}

        </div>

        {/* Tutoring rate. */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">

          <div>

            <p className={`text-2xl font-extrabold ${
              isFree
                ? "text-[#118447]"
                : "text-[#173472]"
            }`}>

              {!validRate
                ? "Rate unavailable"
                : isFree
                  ? "Free tutoring"
                  : `$${hourlyRate.toFixed(2)} CAD /hr`}

            </p>

            {isFree && (
              <p className="mt-1 text-xs text-[#68758c]">
                No payment required
              </p>
            )}

          </div>

          <p className="text-sm text-[#68758c]">
            One-on-one sessions
          </p>

        </div>

        {/* LinkUp, Follow and Message. */}
        <div className="mt-5 flex flex-wrap items-start gap-2">

          {isFree ? (
            <Link
              href={`/tutors/${encodeURIComponent(slug)}/book`}
              aria-label="LinkUp — book a tutoring session"
              title="Book a tutoring session"
              className="btn-primary flex min-w-0 flex-1 basis-28 items-center justify-center py-4"
            >
              LinkUp
            </Link>
          ) : (
            <button
              disabled
              type="button"
              className="min-w-0 flex-1 basis-28 cursor-not-allowed rounded-xl bg-[#edf0f5] py-4 font-semibold text-[#68758c]"
            >
              LinkUp
            </button>
          )}

          <button
            disabled
            type="button"
            aria-label="Follow — coming soon"
            className="min-w-0 flex-1 basis-28 cursor-not-allowed rounded-xl border border-[#e5e9f0] bg-[#f7f9fd] py-2 text-[#68758c]"
          >

            <span className="block text-sm font-bold">
              Follow
            </span>

            <span className="block text-xs">
              Soon
            </span>

          </button>

          <MessageTutorButton
            tutorUserId={tutor.userId}
            wrapperClassName="min-w-0 flex-1 basis-28"
          />

        </div>

        {!isFree && (
          <p className="mt-3 text-sm text-[#9f7500]">
            {validRate
              ? "Paid bookings are coming soon."
              : "This tutor has not configured a valid rate."}
          </p>
        )}

        {/* Upcoming availability. */}
        <div className="mt-5 rounded-xl bg-[#f7f9fc] p-4">

          <h2 className="mb-3 font-extrabold">
            Next available times
          </h2>

          {renderAvailability(
            extras.availability.slice(0, 3)
          )}

        </div>

      </section>

      {/* Interactive tutor profile navigation. */}
      <TutorProfileSections sections={sections} />

    </main>
  );
}
