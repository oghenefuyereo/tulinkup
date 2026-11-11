
import Image from "next/image";
import Link from "next/link";
import { Icon } from "./Icons";

export function TutorCard({ tutor }) {
  const name = tutor.name || tutor.full_name || "Tutor";

  const title = tutor.title || "Tutor";

  const biography = tutor.biography || tutor.bio || "";

  const subjects = Array.isArray(tutor.subjects)
    ? tutor.subjects
    : String(tutor.subject || "")
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => ({ id: name, name }));

  const image = tutor.image?.url
    ? tutor.image
    : tutor.profile_image_url
      ? {
          url: tutor.profile_image_url,
          alt: `${name}, tutor profile`,
        }
      : null;

  const hourlyRate = Number(
    tutor.hourlyRate ?? tutor.hourly_rate ?? 0
  );

  const rating =
    tutor.rating == null ? null : Number(tutor.rating);

  const reviewCount = Number(
    tutor.reviewCount ?? tutor.review_count ?? 0
  );

  const verified = tutor.verified === true;

  const available = tutor.availabilityStatus === "available";

  return (
    <article className="group overflow-hidden rounded-[22px] border border-[#e5e9f0] bg-white shadow-[0_12px_35px_rgba(33,52,91,.07)] transition hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(33,52,91,.12)]">
      <div className="relative h-52 overflow-hidden bg-[#eef2f8]">
        {image ? (
          <Image
            src={image.url}
            alt={image.alt || name}
            fill
            className="object-cover transition duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <div className="grid h-full place-items-center text-5xl font-bold text-[#9aa6bd]">
            {name.charAt(0).toUpperCase()}
          </div>
        )}

        <span
          className={`absolute left-4 top-4 rounded-full px-3 py-1.5 text-xs font-bold ${
            available
              ? "bg-[#e7f7ed] text-[#118447]"
              : "bg-[#fff7dc] text-[#9f7500]"
          }`}
        >
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-current" />
          {available ? "Available now" : "By appointment"}
        </span>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-[#17233d]">
              {name}
            </h3>

            <p className="mt-1 text-sm font-medium text-[#66728a]">
              {title}
            </p>
          </div>

          {verified && (
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#26469b] text-xs font-black text-white"
              title="Verified tutor"
            >
              ✓
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {subjects.map((subject, index) => {
            const subjectName =
              typeof subject === "string"
                ? subject
                : subject.name;

            return (
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

        <p className="mt-4 line-clamp-2 text-sm leading-6 text-[#69758c]">
          {biography || "Explore this tutor's profile to learn more."}
        </p>

        <div className="mt-5 flex items-center justify-between border-t border-[#edf0f5] pt-4">
          <div className="flex items-center gap-1.5 text-sm">
            {rating !== null && Number.isFinite(rating) ? (
              <>
                <Icon
                  name="star"
                  className="h-4 w-4 fill-[#f5c518] stroke-[#f5c518]"
                />

                <span className="font-bold text-[#202c45]">
                  {rating.toFixed(1)}
                </span>

                <span className="text-[#7c879b]">
                  ({reviewCount})
                </span>
              </>
            ) : (
              <span className="text-[#7c879b]">
                No reviews yet
              </span>
            )}
          </div>

          <div className="text-right">
            <span className="text-xl font-extrabold text-[#173472]">
              ${hourlyRate.toFixed(2)}
            </span>

            <span className="text-sm text-[#7c879b]">
              {" "}/hr
            </span>
          </div>
        </div>

        <Link
          href={`/tutors/${encodeURIComponent(tutor.slug)}`}
          className="btn-secondary mt-5 flex w-full items-center justify-center gap-2"
        >
          View profile
          <Icon name="arrow" className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}
