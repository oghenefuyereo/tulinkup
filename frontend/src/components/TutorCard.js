
// Import Image to display tutor profile pictures.
import Image from "next/image";

// Import Link to navigate to tutor profile pages.
import Link from "next/link";

// Import the reusable icons used in the tutor card.
import { Icon } from "./Icons";

// Create a reusable card to display a tutor's information.
export function TutorCard({ tutor }) {
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

  // Get the tutor's hourly teaching rate.
  const hourlyRate = Number(
    tutor.hourlyRate ?? tutor.hourly_rate ?? 0
  );

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

  // Display the tutor's profile information inside a card.
  return (
    <article className="group overflow-hidden rounded-[22px] border border-[#e5e9f0] bg-white shadow-[0_12px_35px_rgba(33,52,91,.07)] transition hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(33,52,91,.12)]">
      {/* Display the tutor's profile image and availability status. */}
      <div className="relative h-52 overflow-hidden bg-[#eef2f8]">
        {/* Show the profile image if one is available. */}
        {image ? (
          <Image
            src={image.url}
            alt={image.alt || name}
            fill
            className="object-cover transition duration-500 group-hover:scale-105"
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
        <div className="mt-5 flex items-center justify-between border-t border-[#edf0f5] pt-4">
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
            <span className="text-xl font-extrabold text-[#173472]">
              ${hourlyRate.toFixed(2)}
            </span>

            <span className="text-sm text-[#7c879b]">
              {" "}/hr
            </span>
          </div>
        </div>

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
