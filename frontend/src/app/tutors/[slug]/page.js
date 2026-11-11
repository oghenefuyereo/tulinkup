
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Footer } from "@/components/Footer";
import { Icon } from "@/components/Icons";
import { MobileNav } from "@/components/MobileNav";

export const dynamic = "force-dynamic";

const API_URL = process.env.API_URL || "http://localhost:5001";

async function getTutorBySlug(slug) {
  const response = await fetch(
    `${API_URL}/api/tutors/${encodeURIComponent(slug)}`,
    { cache: "no-store" }
  );

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error("Unable to load tutor profile.");
  }

  const data = await response.json();
  return data.tutor || null;
}

async function getTutorExtras(slug) {
  const response = await fetch(
    `${API_URL}/api/tutors/${encodeURIComponent(slug)}/extras`,
    { cache: "no-store" }
  );

  if (response.status === 404) {
    return { reviews: [], availability: [] };
  }

  if (!response.ok) {
    throw new Error("Unable to load tutor details.");
  }

  const data = await response.json();

  return {
    reviews: Array.isArray(data.reviews) ? data.reviews : [],
    availability: Array.isArray(data.availability)
      ? data.availability
      : [],
  };
}

export default async function TutorProfilePage({ params }) {
  const { slug } = await params;

  const tutor = await getTutorBySlug(slug);

  if (!tutor) notFound();

  const extras = await getTutorExtras(slug);

  const name = tutor.name || tutor.full_name || "Tutor";
  const subjects = Array.isArray(tutor.subjects)
    ? tutor.subjects
    : typeof tutor.subject === "string"
      ? tutor.subject.split(",").map((subject) => ({
          id: subject.trim(),
          name: subject.trim(),
        }))
      : [];

  const hourlyRate = Number(
    tutor.hourlyRate ?? tutor.hourly_rate ?? 0
  );

  return (
    <>
      <main className="bg-[#f7f9fd] py-8 sm:py-12">
        <div className="page-wrap">
          <Link
            href="/tutors"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#52617b]"
          >
            ← Back to tutors
          </Link>

          <div className="mt-6 grid gap-7 lg:grid-cols-[1fr_360px]">
            <div className="space-y-6">
              <section className="panel overflow-hidden">
                <div className="h-2 bg-[#f5c518]" />

                <div className="flex flex-col gap-6 p-6 sm:flex-row sm:p-8">
                  <div className="relative h-36 w-36 shrink-0 overflow-hidden rounded-[28px] bg-[#edf1f7]">
                    {tutor.image?.url && (
                      <Image
                        src={tutor.image.url}
                        alt={tutor.image.alt || name}
                        fill
                        className="object-cover"
                        sizes="144px"
                      />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h1 className="text-3xl font-extrabold tracking-[-.04em]">
                            {name}
                          </h1>

                          {tutor.verified === true && (
                            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#26469b] text-[10px] font-black text-white">
                              ✓
                            </span>
                          )}
                        </div>

                        <p className="mt-2 font-semibold text-[#5e6a81]">
                          {tutor.title || "Professional Tutor"}
                        </p>
                      </div>

                      {tutor.rating != null && (
                        <div className="flex items-center gap-1.5 rounded-full bg-[#fff7dc] px-3 py-1.5 text-sm font-bold">
                          <Icon
                            name="star"
                            className="h-4 w-4 fill-[#f5c518] stroke-[#f5c518]"
                          />
                          {tutor.rating}
                          <span className="font-medium text-[#7b7357]">
                            ({tutor.reviewCount ?? 0})
                          </span>
                        </div>
                      )}
                    </div>

                    {tutor.location && (
                      <p className="mt-4 flex items-center gap-2 text-sm text-[#69758c]">
                        <Icon
                          name="location"
                          className="h-4 w-4 text-[#26469b]"
                        />
                        {tutor.location}
                      </p>
                    )}

                    <div className="mt-5 flex flex-wrap gap-2">
                      {subjects.map((subject) => {
                        const subjectName =
                          typeof subject === "string"
                            ? subject
                            : subject.name;

                        return (
                          <span
                            className="subject-pill"
                            key={
                              typeof subject === "string"
                                ? subject
                                : subject.id ?? subjectName
                            }
                          >
                            {subjectName}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>

              <section className="panel p-6 sm:p-8">
                <h2 className="text-xl font-extrabold">
                  About {name.split(" ")[0]}
                </h2>

                <p className="mt-4 leading-7 text-[#59667e]">
                  {tutor.biography || tutor.bio || "No biography yet."}
                </p>
              </section>

              <section className="panel p-6 sm:p-8">
                <div className="grid gap-7 sm:grid-cols-2">
                  <div>
                    <h2 className="text-lg font-extrabold">
                      Qualifications
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-[#66728a]">
                      {tutor.qualifications || "Not provided yet."}
                    </p>
                  </div>

                  <div>
                    <h2 className="text-lg font-extrabold">
                      Teaching experience
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-[#66728a]">
                      {tutor.experience || "Not provided yet."}
                    </p>
                  </div>
                </div>
              </section>

              <section className="panel p-6 sm:p-8">
                <h2 className="text-xl font-extrabold">
                  Student reviews
                </h2>

                {extras.reviews.length > 0 ? (
                  <div className="mt-5 space-y-5">
                    {extras.reviews.map((review) => (
                      <article
                        key={review.id}
                        className="border-t border-[#edf0f5] pt-5 first:border-0 first:pt-0"
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-bold">{review.student}</p>
                          <p className="text-sm font-bold text-[#f0b800]">
                            {"★".repeat(
                              Math.max(
                                0,
                                Math.min(5, Number(review.rating) || 0)
                              )
                            )}
                          </p>
                        </div>

                        <p className="mt-2 text-sm leading-6 text-[#66728a]">
                          {review.comment}
                        </p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-[#68758c]">
                    No reviews yet.
                  </p>
                )}
              </section>
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="panel p-6">
                <div className="flex items-end justify-between">
                  <div>
                    <span className="text-3xl font-extrabold text-[#173472]">
                      ${hourlyRate.toFixed(2)}
                    </span>
                    <span className="text-[#71809a]"> / hour</span>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      tutor.availabilityStatus === "available"
                        ? "bg-[#e7f7ed] text-[#118447]"
                        : "bg-[#fff7dc] text-[#9b7300]"
                    }`}
                  >
                    {tutor.availabilityStatus === "available"
                      ? "Available now"
                      : "By appointment"}
                  </span>
                </div>

                <h2 className="mt-7 font-extrabold">
                  Next available times
                </h2>

                <div className="mt-3 space-y-2">
                  {extras.availability.length > 0 ? (
                    extras.availability.slice(0, 3).map((slot) => (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between rounded-xl bg-[#f7f9fc] px-4 py-3 text-sm"
                      >
                        <span className="font-semibold">
                          {slot.date}
                        </span>
                        <span className="font-bold text-[#26469b]">
                          {slot.startTime}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[#71809a]">
                      No available times posted yet.
                    </p>
                  )}
                </div>

                <Link
                  href={`/tutors/${encodeURIComponent(slug)}/book`}
                  className="btn-primary mt-6 flex w-full py-4"
                >
                  Book a session
                </Link>

                <p className="mt-3 text-center text-xs text-[#8490a4]">
                  No payment is collected in this MVP.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <Footer />
      <MobileNav />
    </>
  );
}
