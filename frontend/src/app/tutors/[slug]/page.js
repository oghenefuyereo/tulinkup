
// Import Image to display tutor profile pictures.
import Image from "next/image";

// Import Link to navigate between pages in Next.js.
import Link from "next/link";

// Import notFound to display a 404 page when a tutor does not exist.
import { notFound } from "next/navigation";

// Import the components used on the tutor profile page.
import { Footer } from "@/components/Footer";
import { Icon } from "@/components/Icons";
import { MobileNav } from "@/components/MobileNav";

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

  // Convert the tutor's hourly rate into a number.
  const hourlyRate = Number(
    tutor.hourlyRate ?? tutor.hourly_rate ?? 0
  );

  // Display the tutor's profile, reviews, and booking information.
  return (
    <>
      {/* Main container for the tutor profile page. */}
      <main className="bg-[#f7f9fd] py-8 sm:py-12">
        <div className="page-wrap">
          {/* Provide a link back to the tutor discovery page. */}
          <Link
            href="/tutors"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#52617b]"
          >
            ← Back to tutors
          </Link>

          {/* Organize the tutor's profile and booking details into columns. */}
          <div className="mt-6 grid gap-7 lg:grid-cols-[1fr_360px]">
            <div className="space-y-6">
              {/* Display the tutor's main profile information. */}
              <section className="panel overflow-hidden">
                <div className="h-2 bg-[#f5c518]" />

                <div className="flex flex-col gap-6 p-6 sm:flex-row sm:p-8">
                  {/* Display the tutor's profile picture if one is available. */}
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

                  {/* Display the tutor's name, title, and other details. */}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          {/* Show the tutor's full name. */}
                          <h1 className="text-3xl font-extrabold tracking-[-.04em]">
                            {name}
                          </h1>

                          {/* Show a verification badge for verified tutors. */}
                          {tutor.verified === true && (
                            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#26469b] text-[10px] font-black text-white">
                              ✓
                            </span>
                          )}
                        </div>

                        {/* Display the tutor's professional title. */}
                        <p className="mt-2 font-semibold text-[#5e6a81]">
                          {tutor.title || "Professional Tutor"}
                        </p>
                      </div>

                      {/* Display the tutor's rating when available. */}
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

                    {/* Show the tutor's location if it is provided. */}
                    {tutor.location && (
                      <p className="mt-4 flex items-center gap-2 text-sm text-[#69758c]">
                        <Icon
                          name="location"
                          className="h-4 w-4 text-[#26469b]"
                        />
                        {tutor.location}
                      </p>
                    )}

                    {/* Display the subjects taught by the tutor. */}
                    <div className="mt-5 flex flex-wrap gap-2">
                      {subjects.map((subject) => {
                        // Get the subject name from its stored value.
                        const subjectName =
                          typeof subject === "string"
                            ? subject
                            : subject.name;

                        return (
                          // Display each subject as a label.
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

              {/* Display the tutor's biography. */}
              <section className="panel p-6 sm:p-8">
                <h2 className="text-xl font-extrabold">
                  About {name.split(" ")[0]}
                </h2>

                <p className="mt-4 leading-7 text-[#59667e]">
                  {tutor.biography || tutor.bio || "No biography yet."}
                </p>
              </section>

              {/* Display the tutor's qualifications and teaching experience. */}
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

              {/* Display reviews submitted by students. */}
              <section className="panel p-6 sm:p-8">
                <h2 className="text-xl font-extrabold">
                  Student reviews
                </h2>

                {/* Show student reviews if any have been submitted. */}
                {extras.reviews.length > 0 ? (
                  <div className="mt-5 space-y-5">
                    {extras.reviews.map((review) => (
                      // Display each student's review.
                      <article
                        key={review.id}
                        className="border-t border-[#edf0f5] pt-5 first:border-0 first:pt-0"
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-bold">{review.student}</p>

                          {/* Display the review rating using stars. */}
                          <p className="text-sm font-bold text-[#f0b800]">
                            {"★".repeat(
                              Math.max(
                                0,
                                Math.min(5, Number(review.rating) || 0)
                              )
                            )}
                          </p>
                        </div>

                        {/* Display the student's written feedback. */}
                        <p className="mt-2 text-sm leading-6 text-[#66728a]">
                          {review.comment}
                        </p>
                      </article>
                    ))}
                  </div>
                ) : (
                  // Show a message when the tutor has no reviews.
                  <p className="mt-4 text-[#68758c]">
                    No reviews yet.
                  </p>
                )}
              </section>
            </div>

            {/* Display the tutor's pricing and booking information. */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="panel p-6">
                <div className="flex items-end justify-between">
                  <div>
                    {/* Display the tutor's hourly teaching rate. */}
                    <span className="text-3xl font-extrabold text-[#173472]">
                      ${hourlyRate.toFixed(2)}
                    </span>
                    <span className="text-[#71809a]"> / hour</span>
                  </div>

                  {/* Show the tutor's current availability status. */}
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

                {/* Display the tutor's next available teaching times. */}
                <h2 className="mt-7 font-extrabold">
                  Next available times
                </h2>

                <div className="mt-3 space-y-2">
                  {extras.availability.length > 0 ? (
                    // Show up to three available time slots.
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
                    // Show a message if the tutor has no available slots.
                    <p className="text-sm text-[#71809a]">
                      No available times posted yet.
                    </p>
                  )}
                </div>

                {/* Provide a link to book a session with this tutor. */}
                <Link
                  href={`/tutors/${encodeURIComponent(slug)}/book`}
                  className="btn-primary mt-6 flex w-full py-4"
                >
                  Book a session
                </Link>

                {/* Explain that payments are not included in the current MVP. */}
                <p className="mt-3 text-center text-xs text-[#8490a4]">
                  No payment is collected in this MVP.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </main>

      {/* Display the website footer. */}
      <Footer />

      {/* Display the mobile navigation menu. */}
      <MobileNav />
    </>
  );
}
