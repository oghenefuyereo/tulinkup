
// Import Image to display optimized images in Next.js.
import Image from "next/image";

// Import Link for navigation between pages.
import Link from "next/link";

// Import the components used on the homepage.
import { Footer } from "@/components/Footer";
import { Icon } from "@/components/Icons";
import { MobileNav } from "@/components/MobileNav";
import { TutorCard } from "@/components/TutorCard";

// Make sure the homepage loads fresh information for each request.
export const dynamic = "force-dynamic";

// Set the Express backend URL for retrieving tutor information.
const API_URL = process.env.API_URL || "http://localhost:5001";

// Define the icons displayed for different learning subjects.
const subjectIcons = {
  Mathematics: "∑",
  Programming: "</>",
  English: "Aa",
  Chemistry: "⚗",
  Physics: "Φ",
  Biology: "DNA",
  "Graphic Design": "◇",
};

// Create the default list of subjects displayed on the homepage.
const defaultSubjects = [
  "Mathematics",
  "Programming",
  "English",
  "Chemistry",
  "Physics",
  "Biology",
  "Graphic Design",
].map((name) => ({
  id: name,
  name,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
}));

// Retrieve tutor profiles to display in the featured tutors section.
async function getFeaturedTutors() {
  try {
    // Request tutor information from the Express backend.
    const response = await fetch(`${API_URL}/api/tutors`, {
      cache: "no-store",
    });

    // Return an empty list if the request is unsuccessful.
    if (!response.ok) {
      console.error("Unable to load featured tutors:", response.status);
      return [];
    }

    // Read the tutor information returned by the backend.
    const data = await response.json();

    // Make sure the response contains a valid list of tutors.
    if (!Array.isArray(data.tutors)) return [];

    // Featured status is not stored in the current database.
    // Show the first three available tutor profiles for now.
    return data.tutors.slice(0, 3);
  } catch (error) {
    // Log unexpected errors and keep the homepage accessible.
    console.error("Featured tutors error:", error);
    return [];
  }
}

// Create the main homepage for the TuLinkUp platform.
export default async function HomePage() {
  // Load tutor profiles and the default learning subjects.
  const tutors = await getFeaturedTutors();
  const subjects = defaultSubjects;

  // Replace with a real hosted image when one is available.
  const heroImage = null;

  // Display the homepage sections and navigation components.
  return (
    <>
      <main>
        {/* Display the main introduction section of the homepage. */}
        <section className="relative overflow-hidden bg-[#f7f9fd] py-14 sm:py-20 lg:py-24">
          <div className="absolute -right-28 -top-32 h-96 w-96 rounded-full bg-[#f5c518]/10" />

          <div className="page-wrap relative grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
            <div>
              {/* Display a short message about the platform. */}
              <span className="inline-flex items-center gap-2 rounded-full border border-[#dbe4f5] bg-white px-4 py-2 text-xs font-extrabold text-[#26469b] shadow-sm">
                <span className="h-2 w-2 rounded-full bg-[#25ad61]" />
                Trusted tutors, real progress
              </span>

              {/* Display the main homepage heading. */}
              <h1 className="mt-6 max-w-2xl text-[42px] font-extrabold leading-[1.06] tracking-[-.055em] text-[#17233d] sm:text-6xl">
                Find the right tutor.{" "}
                <span className="text-[#26469b]">
                  Reach your learning goals.
                </span>
              </h1>

              {/* Explain how TuLinkUp helps students find tutors. */}
              <p className="mt-6 max-w-xl text-base leading-7 text-[#68758c] sm:text-lg">
                TuLinkUp connects you with qualified tutors for focused
                one-to-one learning that fits your goals and schedule.
              </p>

              {/* Provide links for students and tutors to get started. */}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/tutors" className="btn-primary gap-2 px-7 py-4">
                  Find a tutor
                  <Icon name="arrow" className="h-4 w-4" />
                </Link>

                <Link
                  href="/register?role=tutor"
                  className="btn-secondary px-7 py-4"
                >
                  Become a tutor
                </Link>
              </div>

              {/* Highlight the main features of the current MVP. */}
              <div className="mt-9 flex flex-wrap gap-x-8 gap-y-3 text-sm font-semibold text-[#56627a]">
                <span className="flex items-center gap-2">
                  <Icon name="check" className="h-5 w-5 text-[#25ad61]" />
                  Tutor profiles
                </span>

                <span className="flex items-center gap-2">
                  <Icon name="check" className="h-5 w-5 text-[#25ad61]" />
                  Flexible scheduling
                </span>

                <span className="flex items-center gap-2">
                  <Icon name="check" className="h-5 w-5 text-[#25ad61]" />
                  No payment required yet
                </span>
              </div>
            </div>

            {/* Display the main image or a placeholder if no image is available. */}
            <div className="relative">
              <div className="relative aspect-[4/4.2] overflow-hidden rounded-[36px] border-[10px] border-white bg-[#dfe6f3] shadow-[0_30px_80px_rgba(23,52,114,.18)]">
                {heroImage?.url ? (
                  <Image
                    src={heroImage.url}
                    alt={heroImage.alt || "TuLinkUp learning"}
                    fill
                    priority
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-8 text-center">
                    <div>
                      <span className="text-6xl">📚</span>
                      <p className="mt-5 text-xl font-extrabold text-[#173472]">
                        Learn. Practice. Build. Connect. Grow.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Display a small card highlighting student progress. */}
              <div className="absolute -bottom-5 -left-4 rounded-2xl border border-white bg-white p-4 shadow-xl sm:-left-8">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e9f8ef] text-[#25ad61]">
                    <Icon name="chart" className="h-6 w-6" />
                  </span>

                  <div>
                    <p className="text-xs font-semibold text-[#7a8599]">
                      Student progress
                    </p>
                    <p className="text-lg font-extrabold text-[#17233d]">
                      Goals achieved
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Explain the three steps involved in using TuLinkUp. */}
        <section id="how-it-works" className="py-20 sm:py-24">
          <div className="page-wrap">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow">Simple by design</p>

              <h2 className="section-title mt-3">
                Your next breakthrough is three steps away
              </h2>

              <p className="mt-4 text-[#68758c]">
                From discovery to your first session in minutes.
              </p>
            </div>

            {/* Display the steps for finding and booking a tutor. */}
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {[
                [
                  "search",
                  "01",
                  "Discover your match",
                  "Search tutors by subject, price and availability.",
                ],
                [
                  "calendar",
                  "02",
                  "Choose a time",
                  "Open a tutor profile and select an available session that works for you.",
                ],
                [
                  "book",
                  "03",
                  "Start learning",
                  "Send your request, get confirmed, and arrive ready to make progress.",
                ],
              ].map(([icon, number, title, description]) => (
                <article key={number} className="panel relative p-7">
                  <span className="absolute right-6 top-5 text-5xl font-black text-[#eef1f7]">
                    {number}
                  </span>

                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#edf1fa] text-[#26469b]">
                    <Icon name={icon} className="h-6 w-6" />
                  </span>

                  <h3 className="mt-6 text-xl font-bold">{title}</h3>

                  <p className="mt-3 text-sm leading-6 text-[#68758c]">
                    {description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Display the popular learning subjects available on TuLinkUp. */}
        <section id="subjects" className="bg-[#f7f9fd] py-20">
          <div className="page-wrap">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="eyebrow">Explore what interests you</p>
                <h2 className="section-title mt-3">
                  Popular subjects
                </h2>
              </div>

              <Link
                href="/tutors"
                className="font-bold text-[#26469b]"
              >
                View all tutors →
              </Link>
            </div>

            {/* Create a link for each subject in the default subject list. */}
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
              {subjects.map((subject) => (
                <Link
                  key={subject.id}
                  href={`/tutors?subject=${encodeURIComponent(subject.slug)}`}
                  className="group rounded-2xl border border-[#e4e9f1] bg-white p-5 text-center shadow-sm transition hover:-translate-y-1 hover:border-[#aab9dd]"
                >
                  {/* Display the icon associated with the subject. */}
                  <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#edf1fa] text-sm font-black text-[#26469b] group-hover:bg-[#26469b] group-hover:text-white">
                    {subjectIcons[subject.name] ?? "✦"}
                  </span>

                  {/* Display the subject name. */}
                  <span className="mt-4 block text-sm font-bold text-[#25324c]">
                    {subject.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Display tutor profiles retrieved from the backend. */}
        <section className="py-20 sm:py-24">
          <div className="page-wrap">
            <div className="flex items-end justify-between gap-5">
              <div>
                <p className="eyebrow">Learn from the best</p>
                <h2 className="section-title mt-3">
                  Featured tutors
                </h2>
              </div>

              <Link
                href="/tutors"
                className="hidden font-bold text-[#26469b] sm:block"
              >
                Browse marketplace →
              </Link>
            </div>

            {/* Show tutor cards when tutor profiles are available. */}
            {tutors.length ? (
              <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {tutors.map((tutor) => (
                  <TutorCard key={tutor.id} tutor={tutor} />
                ))}
              </div>
            ) : (
              // Display a message if no tutor profiles are available.
              <div className="panel mt-10 p-10 text-center text-[#68758c]">
                Tutor profiles will appear here once they are published.
              </div>
            )}
          </div>
        </section>

        {/* Explain the benefits of TuLinkUp for students and tutors. */}
        <section className="bg-[#173472] py-20 text-white">
          <div className="page-wrap grid gap-10 lg:grid-cols-2">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#f5c518]">
                Built for every side of learning
              </p>

              <h2 className="mt-4 text-3xl font-extrabold tracking-[-.035em] sm:text-4xl">
                Confidence for students. Opportunity for tutors.
              </h2>
            </div>

            {/* Display the main benefits for both user roles. */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/8 p-6">
                <h3 className="text-lg font-bold">
                  For students
                </h3>

                {/* List the benefits available to students. */}
                <ul className="mt-4 space-y-3 text-sm text-blue-100/80">
                  {[
                    "Expert help without guesswork",
                    "Flexible one-to-one sessions",
                    "Clear booking status",
                  ].map((item) => (
                    <li key={item} className="flex gap-2">
                      <Icon
                        name="check"
                        className="h-5 w-5 text-[#f5c518]"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl bg-white/8 p-6">
                <h3 className="text-lg font-bold">
                  For tutors
                </h3>

                {/* List the benefits available to tutors. */}
                <ul className="mt-4 space-y-3 text-sm text-blue-100/80">
                  {[
                    "A professional tutor profile",
                    "Control over your availability",
                    "Simple booking management",
                  ].map((item) => (
                    <li key={item} className="flex gap-2">
                      <Icon
                        name="check"
                        className="h-5 w-5 text-[#25d477]"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Display sample testimonials to demonstrate the intended layout. */}
        <section id="testimonials" className="py-20">
          <div className="page-wrap">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow">
                Sample success stories
              </p>
              <h2 className="section-title mt-3">
                Learners move forward here
              </h2>
            </div>

            {/* Display the sample feedback cards. */}
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {[
                [
                  "“Florence made calculus feel manageable and gave me a plan I could actually follow.”",
                  "Maya J.",
                  "Grade 12 student",
                ],
                [
                  "“I found the right coding mentor in one evening. The booking flow was so clear.”",
                  "Daniel K.",
                  "Career switcher",
                ],
                [
                  "“TuLinkUp gives me a professional way to organise requests and protect my teaching time.”",
                  "Amina R.",
                  "English tutor",
                ],
              ].map(([quote, name, role]) => (
                <blockquote key={name} className="panel p-7">
                  {/* Display the star rating for each sample testimonial. */}
                  <div className="flex gap-1 text-[#f5c518]">
                    ★★★★★
                  </div>

                  {/* Display the testimonial message. */}
                  <p className="mt-5 leading-7 text-[#3e4a61]">
                    {quote}
                  </p>

                  {/* Display the sample reviewer's name and role. */}
                  <footer className="mt-6 border-t border-[#edf0f5] pt-4">
                    <p className="font-bold">{name}</p>
                    <p className="text-sm text-[#7a8599]">
                      {role}
                    </p>
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        {/* Encourage visitors to find a tutor or register as a tutor. */}
        <section className="px-5 pb-20">
          <div className="mx-auto max-w-[1120px] overflow-hidden rounded-[28px] bg-[#f5c518] px-6 py-12 text-center sm:px-12">
            <h2 className="text-3xl font-extrabold tracking-[-.04em] text-[#17233d]">
              Ready to make your next lesson count?
            </h2>

            <p className="mx-auto mt-3 max-w-xl text-[#4b4d46]">
              Join TuLinkUp and connect with the right learning partner today.
            </p>

            {/* Display the main calls to action. */}
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/tutors"
                className="btn-primary px-7"
              >
                Find your tutor
              </Link>

              <Link
                href="/register?role=tutor"
                className="rounded-xl border border-[#17233d]/20 bg-white px-7 py-3 text-sm font-bold text-[#17233d]"
              >
                Start tutoring
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Display the website footer. */}
      <Footer />

      {/* Display the mobile navigation menu. */}
      <MobileNav />
    </>
  );
}
