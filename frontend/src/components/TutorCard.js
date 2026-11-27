// Import Image to display tutor profile pictures.
import Image from "next/image";

// Import Link to navigate to tutor profile pages.
import Link from "next/link";

// Import the reusable icons used in the tutor card.
import { Icon } from "./Icons";
import MessageTutorButton from "./messaging/MessageTutorButton";

// Define the maximum hourly teaching rate in cents.
const MAX_HOURLY_RATE_CENTS = 2500;

// Validate and convert the tutor's hourly rate into cents.
function getHourlyRateCents(value) {
  if (
    value == null ||
    !["number", "string"].includes(typeof value) ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const rate = Number(value);

  if (
    !Number.isFinite(rate) ||
    rate < 0 ||
    rate > MAX_HOURLY_RATE_CENTS / 100
  ) {
    return null;
  }

  const cents = Math.round(rate * 100);

  if (Math.abs(rate * 100 - cents) > 0.000001) {
    return null;
  }

  return cents;
}

// Format the hourly rate in Canadian dollars.
function formatCurrency(cents) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

// Create a reusable card to display a tutor's information.
export function TutorCard({
  tutor,
  showQuickActions = false,
}) {
  // Get the tutor's name or use a default value.
  const name = tutor.name || tutor.full_name || "Tutor";

  // Get the tutor's professional title.
  const title = tutor.title || "Tutor";

  // Get the tutor's biography or use an empty string.
  const biography = tutor.biography || tutor.bio || "";

  // Prepare the list of subjects taught by the tutor.
  const subjects = Array.isArray(tutor.subjects)
    ? tutor.subjects
    : String(tutor.subject || "")
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => ({ id: name, name }));

  // Get the tutor's profile image if one is available.
  const image = tutor.image?.url
    ? tutor.image
    : tutor.profile_image_url
      ? {
          url: tutor.profile_image_url,
          alt: `${name}, tutor profile`,
        }
      : null;

  // Get and validate the tutor's hourly teaching rate.
  const hourlyRateCents = getHourlyRateCents(
    tutor.hourlyRate ?? tutor.hourly_rate
  );

  // Check whether the tutor has valid pricing.
  const hasValidRate = hourlyRateCents !== null;

  // Check whether the tutor offers free tutoring.
  const isFree =
    hasValidRate && hourlyRateCents === 0;

  // Get the tutor's rating if one exists.
  const rating =
    tutor.rating == null ? null : Number(tutor.rating);

  // Get the number of reviews received by the tutor.
  const reviewCount = Number(
    tutor.reviewCount ?? tutor.review_count ?? 0
  );

  // Check whether the tutor has been verified.
  const verified = tutor.verified === true;

  // Check whether the tutor is currently marked as available.
  const available = tutor.availabilityStatus === "available";

  // Use the actual tutor user ID for private messaging.
  const tutorUserId =
    typeof tutor.userId === "string"
      ? tutor.userId
      : Number.isSafeInteger(tutor.userId)
        ? String(tutor.userId)
        : "";

  const hasValidTutorUserId =
    /^[1-9]\d{0,18}$/.test(tutorUserId) &&
    BigInt(tutorUserId) <= 9223372036854775807n;

  // Display the tutor's profile information inside a card.
  return (
    <article className="group overflow-hidden rounded-[22px] border border-[#e5e9f0] bg-white shadow-[0_12px_35px_rgba(33,52,91,.07)] transition hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(33,52,91,.12)]">
      {/* Display the tutor's profile image and availability status. */}
      <div className="relative aspect-square overflow-hidden bg-[#eef2f8]">
        {/* Show the profile image if one is available. */}
        {image ? (
          <Image
            src={image.url}
            alt={image.alt || name}
            fill
            className="object-cover object-top"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          // Show the first letter of the tutor's name if no image exists.
          <div className="grid h-full place-items-center text-5xl font-bold text-[#9aa6bd]">
            {name.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Display the tutor's current availability status. */}
        <span
          className={`absolute left-4 top-4 rounded-full px-3 py-1.5 text-xs font-bold ${
            available
              ? "bg-[#e7f7ed] text-[#118447]"
              : "bg-[#fff7dc] text-[#9f7500]"
          }`}
        >
          {/* Display a small status indicator. */}
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-current" />

          {/* Show the appropriate availability message. */}
          {available ? "Available now" : "By appointment"}
        </span>
      </div>

      {/* Display the tutor's details below the image. */}
      <div className="p-5">
        {/* Display the tutor's name, title, and verification status. */}
        <div className="flex items-start justify-between gap-3">
          <div>
            {/* Display the tutor's full name. */}
            <h3 className="text-xl font-bold text-[#17233d]">
              {name}
            </h3>

            {/* Display the tutor's professional title. */}
            <p className="mt-1 text-sm font-medium text-[#66728a]">
              {title}
            </p>
          </div>

          {/* Show a verification badge for verified tutors. */}
          {verified && (
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#26469b] text-xs font-black text-white"
              title="Verified tutor"
            >
              ✓
            </span>
          )}
        </div>

        {/* Display the subjects offered by the tutor. */}
        <div className="mt-4 flex flex-wrap gap-2">
          {subjects.map((subject, index) => {
            // Get the subject name from a string or object.
            const subjectName =
              typeof subject === "string"
                ? subject
                : subject.name;

            return (
              // Display each subject inside a styled label.
              <span
                key={
                  typeof subject === "string"
                    ? `${subject}-${index}`
                    : subject.id ?? `${subjectName}-${index}`
                }
                className="subject-pill"
              >
                {subjectName}
              </span>
            );
          })}
        </div>

        {/* Display a short preview of the tutor's biography. */}
        <p className="mt-4 line-clamp-2 text-sm leading-6 text-[#69758c]">
          {biography || "Explore this tutor's profile to learn more."}
        </p>

        {/* Display the tutor's rating and hourly rate. */}
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#edf0f5] pt-4">
          {/* Display the tutor's rating and number of reviews. */}
          <div className="flex items-center gap-1.5 text-sm">
            {/* Show rating information only when a valid rating exists. */}
            {rating !== null && Number.isFinite(rating) ? (
              <>
                {/* Display a star icon beside the rating. */}
                <Icon
                  name="star"
                  className="h-4 w-4 fill-[#f5c518] stroke-[#f5c518]"
                />

                {/* Display the tutor's rating to one decimal place. */}
                <span className="font-bold text-[#202c45]">
                  {rating.toFixed(1)}
                </span>

                {/* Display the total number of reviews. */}
                <span className="text-[#7c879b]">
                  ({reviewCount})
                </span>
              </>
            ) : (
              // Display a message when the tutor has no rating.
              <span className="text-[#7c879b]">
                No reviews yet
              </span>
            )}
          </div>

          {/* Display the tutor's hourly teaching rate. */}
          <div className="text-right">
            {!hasValidRate ? (
              <span className="text-sm font-bold text-[#7c879b]">
                Rate unavailable
              </span>
            ) : isFree ? (
              <>
                <span className="text-xl font-extrabold text-[#118447]">
                  Free
                </span>

                <p className="mt-1 text-xs text-[#7c879b]">
                  No payment required
                </p>
              </>
            ) : (
              <>
                <span className="text-xl font-extrabold text-[#173472]">
                  {formatCurrency(hourlyRateCents)}
                </span>

                <span className="text-sm text-[#7c879b]">
                  {" "}CAD /hr
                </span>
              </>
            )}
          </div>
        </div>

        {/* Display the tutoring session type. */}
        <p className="mt-3 text-xs text-[#7c879b]">
          One-on-one tutoring
        </p>

        {/* Inform students when paid bookings are unavailable. */}
        {hasValidRate && !isFree && (
          <p className="mt-3 rounded-lg bg-[#fff7dc] p-2.5 text-xs font-medium text-[#9f7500]">
            Paid bookings are coming soon.
          </p>
        )}

        {/* Inform students when the tutor has no valid pricing. */}
        {!hasValidRate && (
          <p className="mt-3 rounded-lg bg-[#fff7dc] p-2.5 text-xs font-medium text-[#9f7500]">
            This tutor has not configured a valid hourly rate.
          </p>
        )}

        {/* Quick actions for Learning Feed tutor recommendations. */}
        {showQuickActions && (
          <div className="mt-5 flex flex-wrap items-start gap-2">
            {isFree && (
              <Link
                href={`/tutors/${encodeURIComponent(tutor.slug)}/book`}
                className="btn-primary flex min-w-0 flex-1 basis-36 items-center justify-center py-4 text-center"
                aria-label="LinkUp — book a tutoring session"
                title="Book a tutoring session"
              >
                LinkUp
              </Link>
            )}

            {hasValidTutorUserId && (
              <MessageTutorButton
                tutorUserId={tutorUserId}
                wrapperClassName="min-w-0 flex-1 basis-36"
              />
            )}
          </div>
        )}

        {/* Link to the tutor's full profile page. */}
        <Link
          href={`/tutors/${encodeURIComponent(tutor.slug)}`}
          className="btn-secondary mt-5 flex w-full items-center justify-center gap-2"
        >
          View profile

          {/* Display an arrow icon beside the link. */}
          <Icon name="arrow" className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}